import json
import base64
import uuid
import boto3
import os
# Import the improved extraction class instead of the old one
from improved_extraction import ImprovedExtraction

DYNAMO_TABLE = os.getenv("TABLE_NAME", "admin-question-bank")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DYNAMO_TABLE)


def normalize_item(item):
    """Đảm bảo mỗi item có id duy nhất"""
    if "id" not in item:
        # Generate numeric ID using timestamp + random for uniqueness
        import time
        item["id"] = int(time.time() * 1000000) + int(uuid.uuid4().int % 1000000)
    return item


def upload_items(items):
    """Upload danh sách items vào DynamoDB"""
    count = 0
    for item in items:
        table.put_item(Item=normalize_item(item))
        count += 1
    return count


def lambda_handler(event, context):
    print("EVENT:", json.dumps(event, indent=2, default=str))

    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": ""
        }

    try:
        # 1. Kiểm tra body
        if "body" not in event or event["body"] is None:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "No body received"})
            }

        # 2. Decode JSON body
        try:
            raw_body = event["body"].strip()
            # Proxy integration tự động decode base64 rồi
            body = json.loads(raw_body)
        except Exception as e:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": f"Invalid JSON body: {str(e)}"})
            }

        # 3. Kiểm tra field "file"
        if "file" not in body:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "Missing 'file' field in body"})
            }

        # 4. Decode PDF từ base64
        try:
            pdf_bytes = base64.b64decode(body["file"])
        except Exception as e:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": f"Invalid base64 PDF: {str(e)}"})
            }

        # 5. Lưu PDF vào /tmp
        pdf_path = f"/tmp/{uuid.uuid4()}.pdf"
        try:
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": f"Failed to save PDF: {str(e)}"})
            }

        # 6. Xử lý PDF với ImprovedExtraction (UPDATED)
        try:
            extraction = ImprovedExtraction(pdf_path)  # Using improved version
            questions = extraction.create_json()

            if not questions or not isinstance(questions, list):
                return {
                    "statusCode": 500,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps({"error": "No questions extracted from PDF"})
                }

        except Exception as e:
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": f"Extraction failed: {str(e)}"})
            }
        finally:
            try:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
            except:
                pass

        # 7. Upload vào DynamoDB
        try:
            uploaded_count = upload_items(questions)
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": f"DynamoDB upload failed: {str(e)}"})
            }

        # 8. Response thành công
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "status": "success",
                "questions": len(questions),
                "uploaded": uploaded_count
            })
        }

    # CRITICAL: Catch all exceptions
    except Exception as e:
        print(f"UNHANDLED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": f"Internal error: {str(e)}"})
        }