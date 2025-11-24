import json
import boto3
import os
from datetime import datetime
from decimal import Decimal
import base64

# Get the service resource.
dynamodb = boto3.resource('dynamodb')
# Get the table. Assumes table name is passed as an environment variable, with a fallback.
table_name = os.environ.get('USER_EXAM_TABLE', 'user-exam')
table = dynamodb.Table(table_name)

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        return super(DecimalEncoder, self).default(o)

def extract_user_from_token(event):
    """Extract user_id from JWT token in Authorization header"""
    try:
        # Get the Authorization header
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization') or headers.get('authorization')
        
        if not auth_header:
            return None
            
        # Extract the token (remove 'Bearer ' prefix)
        token = auth_header.replace('Bearer ', '').replace('bearer ', '')
        
        # Decode the JWT payload (we don't verify signature here, just extract claims)
        # Split the token and get the payload part
        parts = token.split('.')
        if len(parts) != 3:
            return None
            
        # Decode the payload (add padding if needed)
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
            
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        
        # Return the sub claim (user_id)
        return claims.get('sub')
    except Exception as e:
        print(f"Error extracting user from token: {str(e)}")
        return None

def lambda_handler(event, context):
    try:
        # Get HTTP method
        http_method = event.get('httpMethod', 'POST')
        
        # Get user ID from the Cognito authorizer context
        user_id = None
        if 'requestContext' in event and 'authorizer' in event['requestContext']:
            authorizer = event['requestContext']['authorizer']
            if authorizer and 'claims' in authorizer:
                user_id = authorizer['claims'].get('sub')
        
        # If no authorizer, try to extract from JWT token in header
        if not user_id:
            user_id = extract_user_from_token(event)
        
        # For POST requests, also check if user_id is in body for backward compatibility
        if not user_id and http_method == 'POST':
            try:
                body = json.loads(event.get('body', '{}'))
                user_id = body.get('user_id')
            except:
                pass
        
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                'body': json.dumps({'message': 'Unauthorized: User ID not found'})
            }
        
        # Handle GET request for exam history
        if http_method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            request_type = query_params.get('type', 'all')
            exam_id = query_params.get('exam_id')

            # Handle type=all: Return all exams for the user
            if request_type == 'all':
                # Scan table with filter for user_id
                response = table.scan(
                    FilterExpression='user_id = :uid',
                    ExpressionAttributeValues={
                        ':uid': user_id
                    }
                )
                
                items = response.get('Items', [])
                
                # Extract only the necessary fields for the exam list
                exam_list = []
                for item in items:
                    exam_list.append({
                        'exam_id': item.get('exam_id'),
                        'exam_start_time': item.get('exam_start_time'),
                        'exam_finish_time': item.get('exam_finish_time'),
                        'correct_count': item.get('correct_count'),
                        'total_questions': item.get('total_questions')
                    })
                
                # Sort by exam_finish_time descending (most recent first)
                exam_list.sort(key=lambda x: x.get('exam_finish_time', ''), reverse=True)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                    },
                    'body': json.dumps({
                        'exams': exam_list,
                        'count': len(exam_list)
                    }, cls=DecimalEncoder)
                }

            # Handle type=single: Return question_ids for a specific exam
            elif request_type == 'single':
                if not exam_id:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                        },
                        'body': json.dumps({'message': 'Missing exam_id parameter for type=single'})
                    }
                
                # Get the specific exam
                try:
                    exam_id_int = int(exam_id)
                except ValueError:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                        },
                        'body': json.dumps({'message': 'Invalid exam_id format'})
                    }
                
                response = table.get_item(
                    Key={
                        'exam_id': exam_id_int,
                        'user_id': user_id
                    }
                )
                
                item = response.get('Item')
                
                if not item:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                        },
                        'body': json.dumps({'message': 'Exam not found'})
                    }
                
                # Extract question_ids from the questions list
                questions = item.get('questions', [])
                question_ids = [q.get('question_id') for q in questions if 'question_id' in q]
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                    },
                    'body': json.dumps({
                        'exam_id': exam_id_int,
                        'question_ids': question_ids,
                        'exam_info': {
                            'exam_start_time': item.get('exam_start_time'),
                            'exam_finish_time': item.get('exam_finish_time'),
                            'correct_count': item.get('correct_count'),
                            'total_questions': item.get('total_questions')
                        }
                    }, cls=DecimalEncoder)
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                    },
                    'body': json.dumps({'message': 'Invalid type parameter. Use type=all or type=single'})
                }
        
        # Handle POST request for submission (existing logic)
        elif http_method == 'POST':
            # Parse the request body
            body = json.loads(event['body'])
            exam_data = body.get('examData', {})
            user_answers = body.get('answers', {})  # Format: {"groupId-subIdx": "A", ...}
            exam_start_time = body.get('examStartTime')
            # Add 'Z' suffix to indicate UTC timezone (consistent with frontend)
            submission_time = datetime.utcnow().isoformat() + 'Z'

            # --- Grading Logic ---
            question_list_for_db = []
            correct_count = 0

            def grade_group(groups, user_answers):
                nonlocal correct_count
                
                graded_qs = []
                if not groups:
                    return graded_qs

                for group in groups:
                    group_id = group.get('id')
                    subquestions = group.get('subquestions', [])
                    for i, sub_q in enumerate(subquestions):
                        # Question ID format from frontend: "groupId-subIdx"
                        question_id = f"{group_id}-{i}"
                        user_choice = user_answers.get(question_id)
                        correct_answer = sub_q.get('correct_answer')
                        
                        if user_choice == correct_answer:
                            correct_count += 1
                        
                        # Store question data in database
                        graded_qs.append({
                            'question_id': question_id,
                            'group_id': group_id,
                            'subquestion_index': i,
                            'correct_answer': correct_answer,
                            'user_choice': user_choice
                        })
                return graded_qs

            # Grade questions in the same order as the frontend to ensure IDs match
            question_list_for_db.extend(grade_group(exam_data.get('groups', {}).get('fill_short'), user_answers))
            question_list_for_db.extend(grade_group(exam_data.get('reorder_questions'), user_answers))
            question_list_for_db.extend(grade_group(exam_data.get('groups', {}).get('fill_long'), user_answers))
            question_list_for_db.extend(grade_group(exam_data.get('groups', {}).get('reading'), user_answers))
            
            total_questions = len(question_list_for_db)

            # --- Prepare item for DynamoDB ---
            exam_id = exam_data.get('quiz_id')
            if not exam_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                    },
                    'body': json.dumps({'message': 'Missing exam_id (quiz_id) in request body'})
                }

            item = {
                'exam_id': int(exam_id),
                'user_id': user_id,
                'exam_start_time': exam_start_time,
                'exam_finish_time': submission_time,
                'correct_count': correct_count,
                'total_questions': total_questions,
                'questions': question_list_for_db,
                'exam_data': exam_data,  # Store full exam data from currentExam
                'user_answers': user_answers  # Store user answers from examAnswers
            }

            # --- Save to DynamoDB ---
            table.put_item(Item=item)

            # --- Return Response ---
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                'body': json.dumps({
                    'message': 'Submission successful',
                    'exam_id': exam_id,
                    'correct_count': correct_count,
                    'total_questions': total_questions
                }, cls=DecimalEncoder)
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                'body': json.dumps({'message': 'Method not allowed'})
            }

    except Exception as e:
        # Log error for debugging
        print(f"Error processing submission: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': json.dumps({'message': 'An error occurred during submission.', 'error': str(e)})
        }
