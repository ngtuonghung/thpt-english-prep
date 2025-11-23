#!/usr/bin/env python3
"""
Improved PDF Extraction Script
"""

import pymupdf
import pymupdf4llm
import sys
import re
import uuid
import json
import time
from collections import Counter


class Extraction:
    def __init__(self, ifile):
        self.ifile = ifile
        self.md_text = pymupdf4llm.to_markdown(
            ifile,
            page_chunks=False,
            write_images=False,
            show_progress=False
        )
        self.remove_headers_and_footers()
        self.extract_answer()
        self.clean_hyperlinks()
        
    def clean_hyperlinks(self):
        self.md_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', self.md_text)
        self.md_text = re.sub(r'(\d+)\s*\*\*\s*(\d+)\*\*', r'\1\2', self.md_text)
        self.md_text = re.sub(r'(\d+)\s*\*\s*(\d+)\*', r'\1\2', self.md_text)
        
    def remove_headers_and_footers(self):
        repeated_lines = self.extract_headers_and_footers()
        lines = self.md_text.splitlines()
        cleaned_lines = []

        for line in lines:
            lower_line = line.lower().strip()
            if any(hf.lower() in lower_line for hf in repeated_lines):
                continue 
            cleaned_lines.append(line)

        cleaned_md = "\n".join(cleaned_lines).strip()
        cleaned_md = re.sub(r"\n{3,}", "\n\n", cleaned_md)
        self.md_text = cleaned_md

    def extract_headers_and_footers(self):
        pdf_reader = pymupdf.open(self.ifile)
        headers_and_footers = []
        self.raw_text = ""
        self.last_page = ""
        
        for page in pdf_reader:
            self.raw_text += page.get_text()
            self.last_page = page.get_text()
            for line in page.get_text().splitlines():
                if re.search(r'\w', line):
                    headers_and_footers.append(line.strip())

        counter = Counter(headers_and_footers)
        num_pages = len(pdf_reader)
        repeated_lines = [line for line, count in counter.items() if count >= num_pages]
        
        pdf_reader.close()
        return repeated_lines

    def extract_answer(self):
        pattern = re.compile(r'(?mi)\b(\d+)\s*[\.\-: ]\s*([A-D])\b')
        self.answer_map = {}
        for match in pattern.finditer(self.last_page):
            qnum = int(match.group(1))
            answer = match.group(2).upper()
            self.answer_map[qnum] = answer
    
    def get_answer_of_question(self, question):
        return self.answer_map.get(question)

    def preserve_formatting(self, text):
        text = re.sub(r'\*{3,}', '**', text)
        text = re.sub(r'_{6,}', '_____', text)
        return text

    def clean_text_content(self, text):
        lines = text.split('\n')
        processed_lines = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            if not line:
                if processed_lines and processed_lines[-1] != '':
                    processed_lines.append('')
                continue
            
            line = re.sub(r'^[*_]{3,}', '', line)
            line = re.sub(r'[*_]{3,}$', '', line)
            line = re.sub(r'\s+', ' ', line)
            line = re.sub(r'\s+([.,!?;:])', r'\1', line)
            line = re.sub(r'([.,!?;:])\s*$', r'\1', line)
            
            if not line:
                continue
                
            should_merge = False
            if processed_lines and i < len(lines) - 1:
                prev_line = processed_lines[-1] if processed_lines else ''
                
                if (prev_line and 
                    not re.search(r'[.!?:]\s*$', prev_line) and
                    not re.search(r'^[●○■□\-\*\d+\)]', line) and
                    not re.search(r'^\([A-Z\d]+\)', line) and
                    not re.search(r'^[a-f]\.\s', line) and  # Not a. b. c. etc
                    re.search(r'^[a-z]', line)):
                    should_merge = True
            
            if should_merge and processed_lines:
                processed_lines[-1] = processed_lines[-1] + ' ' + line
            else:
                processed_lines.append(line)
        
        text = '\n'.join(processed_lines)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'([.!?])\s*([●○■□\-])', r'\1\n\2', text)
        return text.strip()

    def extract_context_from_block(self, text, first_question_num):
        m = re.search(rf"(?i)\bQuestion\s*{first_question_num}\b", text)
        if m:
            context = text[:m.start()].strip()
        else:
            context = text.strip()
        
        context = self.clean_context(context)
        context = re.sub(r'^\*{1,2}\s*', '', context)
        context = re.sub(r'\s*\*{1,2}$', '', context)
        context = re.sub(r'^_+\s*\n+', '', context)
        context = self.clean_text_content(context)
        context = self.preserve_formatting(context)
        return context

    def get_block(self, reg):
        results = []
        pattern = re.compile(reg)
        
        cleaned = self.md_text
        cleaned = re.sub(r'\*\*\s*\n', '\n', cleaned)
        cleaned = re.sub(r'\n\s*\*\*', '\n', cleaned)
        cleaned = re.sub(r'\*{3,}', '**', cleaned)

        for match in pattern.finditer(cleaned):
            full_block, x, y = match.groups()
            results.append({
                "x": int(x),
                "y": int(y),
                "context": full_block.strip()
            })
        return results
    
    def create_json(self):
        results = []
        extracted_ranges = set()  # Track (x, y) ranges to avoid duplicates

        # Pattern for reordering questions (Mark the letter... arrange...)
        reorder_reg = r'(?sm)(Mark\s+the\s+letter.*?(?:arrangement|exchange|text).*?from\s+(\d+)\s+to\s+(\d+).*?Question\s*\3\b.*?(?:A[.)].*?B[.)].*?C[.)].*?D[.)].*?(?=Question\s*\d+|$)))'

        # Pattern for reading passages (more specific - must have "Read the following")
        group_choices_reg = r'(?si)(Read\s+the\s+following\s+(?:passage|text|extract).*?from\s+(\d+)\s+to\s+(\d+).*?Question\s*\3\b.*?(?:A[.)].*?B[.)].*?C[.)].*?D[.)].*?(?=\n|$)))'

        # Pattern for fill-in-the-blank with shared context
        fill_reg = r'(?sm)((?:FEELING|Our|[A-Z][a-z]+(?:\s+[a-z]+){1,5}).*?from\s+(\d+)\s+to\s+(\d+).*?Question\s*\3\b.*?(?:A[.)].*?B[.)].*?C[.)].*?D[.)].*?(?=\n|$)))'

        # Extract reordering questions FIRST (so they don't get matched by fill_reg)
        reorder_block = self.get_block(reorder_reg)
        for block in reorder_block:
            question_range = (block["x"], block["y"])
            if question_range not in extracted_ranges:
                extracted_ranges.add(question_range)
                # Extract as individual questions (type 0)
                single_questions = self.extract_components([block], single=True)
                if single_questions and len(single_questions) > 0:
                    # Flatten the list - single_questions is a list containing one list of questions
                    for sq in single_questions[0]:
                        results.append(sq)

        # Extract reading passages second
        group_choices_block = self.get_block(group_choices_reg)
        for block in group_choices_block:
            question_range = (block["x"], block["y"])
            if question_range not in extracted_ranges:
                extracted_ranges.add(question_range)
                extracted = self.extract_components([block], single=False)
                results += extracted

        # Extract fill-in-the-blank sections last (skip if already extracted)
        fill_block = self.get_block(fill_reg)
        for block in fill_block:
            question_range = (block["x"], block["y"])
            if question_range not in extracted_ranges:
                extracted_ranges.add(question_range)
                extracted = self.extract_components([block], single=False)
                results += extracted

        # Sort results by the first question number in each block
        def get_first_question_num(block):
            # Use the stored _start_question field
            start_q = block.get("_start_question")
            if start_q is not None:
                return start_q
            return 999  # Default high number for sorting

        results.sort(key=get_first_question_num)

        # Remove the temporary _start_question field before returning
        for block in results:
            if "_start_question" in block:
                del block["_start_question"]

        return results

    def extract_components(self, blocks, single=False):
        data = []

        for block in blocks:
            text = block["context"]
            x, y = block["x"], block["y"]

            subquestions = self.extract_questions_and_content(x, y, text, single)

            if not single:
                context = self.extract_context_from_block(text, x)
                question_type = self.label_type(subquestions, single)

                questions = {
                    "id": int(time.time() * 1000000) + int(uuid.uuid4().int % 1000000),
                    "type": 1,
                    "context": context,
                    "subquestions": subquestions,
                    "question_type": question_type,
                    "_start_question": x  # Store for sorting
                }
                data.append(questions)
            else:
                # For single questions, add start number to first question
                if subquestions:
                    subquestions[0]["_start_question"] = x
                data.append(subquestions)

        return data
    
    def label_type(self, subquestions, single=True):
        is_reading_type = True
        is_fill_short = False
        has_reorder_pattern = False

        for subques in subquestions:
            if len(subques["content"]) == 0:
                is_reading_type = False

            # Check for reorder pattern in options (a - b - c format with at least 2 letters separated by dashes)
            # Pattern must have at least two letter-dash sequences, like "a – b" or "c – a – b"
            for option in subques["options"]:
                # More specific pattern: must start with a letter, then have at least one more letter separated by dash
                # and all parts must be single letters (not part of words)
                if re.match(r'^[a-f]\s*[–\-]\s*[a-f](?:\s*[–\-]\s*[a-f])*\s*$', option.strip()):
                    has_reorder_pattern = True
                    break
                # Short option: 1-2 words
                if re.fullmatch(r'\s*\w+(?:\s+\w+)?\s*', option):
                    is_fill_short = True

        # If any question has reorder pattern in options, it's a reorder type
        if has_reorder_pattern:
            return "reorder"

        if is_reading_type:
            return "reading"
        elif is_fill_short:
            return "fill_short"
        else:
            return "fill_long"

    def extract_questions_and_content(self, x, y, text, single=False):
        pattern = re.compile(
            r"(?s)\*{0,2}\s*Question\s*(\d+)\s*[:：]?\s*(.*?)\s*"
            r"(.*?)"
            r"\*{0,2}\s*A[.)]\s*(.*?)\s*"
            r"\*{0,2}\s*B[.)]\s*(.*?)\s*"
            r"\*{0,2}\s*C[.)]\s*(.*?)\s*"
            r"\*{0,2}\s*D[.)]\s*(.*?)(?=(?:\n\s*\*{0,2}\s*Question\s*\d+\b)|\Z)"
        )
        
        subquestions = []
        
        for match in pattern.finditer(text):
            qnum = int(match.group(1))
            
            if not (x <= qnum <= y):
                continue
            
            title = match.group(2).strip()
            content_part = match.group(3).strip()
            content = (title + " " + content_part).strip()
            
            if not re.search(r'\w', content):
                content = ""
            else:
                content = self.clean_content(content)
                content = self.clean_text_content(content)
                content = self.preserve_formatting(content)
            
            options = []
            for i in range(4, 8):
                opt = match.group(i).strip()
                opt = re.sub(r'^\*{1,2}\s*', '', opt)
                opt = re.sub(r'\s*\*{1,2}$', '', opt)
                opt = self.clean_text_content(opt)
                opt = self.preserve_formatting(opt)
                options.append(opt)
            
            correct_answer = self.get_answer_of_question(qnum)

            ques = {
                "content": content,
                "options": options,
                "correct_answer": correct_answer
            }

            # Only mark as reorder at subquestion level if single=True (standalone reorder questions)
            if single:
                ques["question_type"] = "reorder"
                ques["type"] = 0
                ques["id"] = int(time.time() * 1000000) + int(uuid.uuid4().int % 1000000)

            subquestions.append(ques)
            
        return subquestions

    def clean_context(self, text):
        text = re.sub(r'(?si)^.*?from\s+\d+\s+to\s+\d+\s*\.?', '', text)
        return text.strip()

    def clean_content(self, text):
        text = re.sub(r'^[^A-Za-zÀ-ỹ0-9(]+', '', text)
        return text.strip()


def main():
    if len(sys.argv) < 2:
        print("Usage: python extraction.py <pdf_file>")
        sys.exit(1)
    
    pdf_file = sys.argv[1]
    
    try:
        extractor = Extraction(pdf_file)
        results = extractor.create_json()
        print(json.dumps(results, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()