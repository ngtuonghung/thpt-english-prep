import json
import boto3
import os
from datetime import datetime
from decimal import Decimal

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

def lambda_handler(event, context):
    try:
        # Get user ID from the Cognito authorizer context, with a fallback for testing
        user_id = 'test-user-id' # Default for testing
        if 'requestContext' in event and 'authorizer' in event['requestContext'] and event['requestContext']['authorizer'] and 'claims' in event['requestContext']['authorizer']:
            user_id = event['requestContext']['authorizer']['claims'].get('sub', 'test-user-id')

        # Parse the request body
        body = json.loads(event['body'])
        exam_data = body.get('examData', {})
        user_answers = body.get('answers', {})  # Format: {"groupId-subIdx": "A", ...}
        exam_start_time = body.get('examStartTime')
        submission_time = datetime.utcnow().isoformat()

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
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({
                'message': 'Submission successful',
                'exam_id': exam_id,
                'correct_count': correct_count,
                'total_questions': total_questions
            }, cls=DecimalEncoder)
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
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({'message': 'An error occurred during submission.', 'error': str(e)})
        }
