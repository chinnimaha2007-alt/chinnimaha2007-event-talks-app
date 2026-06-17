import os
import re
from collections import Counter

def get_sentences(text):
    """Splits text into clean sentences using basic regex boundaries."""
    # Split on periods, exclamation marks, or question marks followed by spaces
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def summarize_text(text, num_sentences=3):
    """Summarizes text into 3 sentences using simple word frequency sentence scoring."""
    sentences = get_sentences(text)
    if len(sentences) <= num_sentences:
        return text

    # Tokenize words to calculate frequencies (ignoring common stop words)
    words = re.findall(r'\b\w+\b', text.lower())
    stop_words = set([
        'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
        'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'it', 'its',
        'he', 'she', 'they', 'we', 'you', 'this', 'that', 'these', 'those'
    ])
    word_freqs = Counter(w for w in words if w not in stop_words)

    # Score each sentence based on the sum of word frequencies it contains
    sentence_scores = {}
    for i, sentence in enumerate(sentences):
        score = 0
        sentence_words = re.findall(r'\b\w+\b', sentence.lower())
        for word in sentence_words:
            if word in word_freqs:
                score += word_freqs[word]
        
        # Normalize score by sentence length to prevent biased scoring of long sentences
        word_count = len(sentence_words)
        if word_count > 0:
            sentence_scores[i] = score / word_count
        else:
            sentence_scores[i] = 0

    # Pick the top N highest scoring sentences
    top_indices = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:num_sentences]
    
    # Sort selected sentences back to their chronological order in the text
    summary_sentences = [sentences[idx] for idx in sorted(top_indices)]
    return " ".join(summary_sentences)

def run_summarization():
    folder_path = os.path.dirname(os.path.abspath(__file__))
    files = [f for f in os.listdir(folder_path) if f.lower().endswith('.txt')]
    
    processed_count = 0
    for filename in files:
        # Avoid summarizing existing summaries or system files
        if filename.startswith('summary_') or filename.startswith('.gitkeep'):
            continue
            
        file_path = os.path.join(folder_path, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if not content.strip():
                print(f"Skipping empty file: {filename}")
                continue
                
            summary = summarize_text(content, num_sentences=3)
            
            output_filename = f"summary_{filename}"
            output_path = os.path.join(folder_path, output_filename)
            
            with open(output_path, 'w', encoding='utf-8') as out_f:
                out_f.write(summary)
                
            print(f"Summarized: {filename} -> {output_filename}")
            processed_count += 1
        except Exception as e:
            print(f"Failed to process {filename}: {e}")
            
    if processed_count == 0:
        print("No source .txt files found to summarize in the Documents folder.")

if __name__ == '__main__':
    run_summarization()
