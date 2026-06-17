import os
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
MOCK_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_feed.xml")

def parse_xml_feed(xml_content):
    """Parses Atom XML feed and extracts structured release notes."""
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        print(f"Error parsing XML content: {e}")
        return []
    
    entries = []
    # Find all entries under the atom namespace
    for entry_el in root.findall('atom:entry', namespaces):
        # Extract ID
        entry_id = entry_el.find('atom:id', namespaces)
        entry_id = entry_id.text if entry_id is not None else ""
        
        # Extract Title
        title_el = entry_el.find('atom:title', namespaces)
        title = title_el.text if title_el is not None else ""
        
        # Extract Dates
        published_el = entry_el.find('atom:published', namespaces)
        published = published_el.text if published_el is not None else ""
        
        updated_el = entry_el.find('atom:updated', namespaces)
        updated = updated_el.text if updated_el is not None else ""
        
        # Extract Link (usually an alternate HTML page link)
        link_href = ""
        for link in entry_el.findall('atom:link', namespaces):
            if link.attrib.get('rel') == 'alternate':
                link_href = link.attrib.get('href', '')
                break
        if not link_href:
            # Fallback to the first available link tag
            link_el = entry_el.find('atom:link', namespaces)
            if link_el is not None:
                link_href = link_el.attrib.get('href', '')
                
        # Extract HTML Content
        content_el = entry_el.find('atom:content', namespaces)
        content_html = content_el.text if content_el is not None else ""
        
        entries.append({
            'id': entry_id,
            'title': title,
            'published': published,
            'updated': updated,
            'link': link_href,
            'content': content_html
        })
        
    return entries

@app.route('/')
def home():
    """Renders the main single-page application dashboard."""
    return render_template('index.html')

@app.route('/api/notes')
def get_release_notes():
    """Fetches, parses, and returns the BigQuery release notes."""
    is_mocked = False
    error_message = None
    xml_data = None
    
    # Attempt to fetch live feed
    try:
        response = requests.get(FEED_URL, timeout=8)
        if response.status_code == 200:
            xml_data = response.content
        else:
            error_message = f"Failed to fetch live feed (HTTP {response.status_code})."
            is_mocked = True
    except Exception as e:
        error_message = f"Network connection failed: {str(e)}"
        is_mocked = True
        
    # Fallback to local mock feed if needed
    if is_mocked or not xml_data:
        try:
            if os.path.exists(MOCK_FILE_PATH):
                with open(MOCK_FILE_PATH, 'rb') as f:
                    xml_data = f.read()
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Mock file not found and network is unavailable.'
                }), 500
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Failed to read local fallback: {str(e)}'
            }), 500
            
    # Parse the XML feed (whether live or mocked)
    entries = parse_xml_feed(xml_data)
    
    return jsonify({
        'status': 'success',
        'is_mocked': is_mocked,
        'error_message': error_message if is_mocked else None,
        'data': entries
    })

if __name__ == '__main__':
    # Run Flask local server
    app.run(host='127.0.0.1', port=5000, debug=True)
