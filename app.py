# app.py
from flask import Flask, render_template, request, send_file, jsonify
from werkzeug.utils import secure_filename
from PyPDF2 import PdfMerger
import io
import os
import uuid

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Dictionary to store uploaded files in memory for each session
session_files = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No file selected'}), 400
    
    if file and file.filename.lower().endswith('.pdf'):
        # Get or create session ID
        session_id = request.form.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            session_files[session_id] = []
        
        # Secure the filename
        filename = secure_filename(file.filename)
        
        # Read file data into memory
        file_data = file.read()
        
        # Add file to session
        if session_id not in session_files:
            session_files[session_id] = []
        
        file_info = {
            'original_name': filename,
            'data': file_data,
            'id': str(uuid.uuid4())
        }
        session_files[session_id].append(file_info)
        
        return jsonify({
            'status': 'success',
            'message': 'File uploaded successfully',
            'session_id': session_id,
            'file_id': file_info['id'],
            'file_name': file_info['original_name']
        })
    
    return jsonify({'status': 'error', 'message': 'Only PDF files are allowed'}), 400

@app.route('/files', methods=['GET'])
def get_files():
    session_id = request.args.get('session_id')
    if not session_id or session_id not in session_files:
        return jsonify({'status': 'error', 'message': 'Invalid session'}), 400
    
    files = []
    for file_info in session_files[session_id]:
        files.append({
            'id': file_info['id'],
            'name': file_info['original_name']
        })
    
    return jsonify({'status': 'success', 'files': files})

@app.route('/remove', methods=['POST'])
def remove_file():
    data = request.json
    session_id = data.get('session_id')
    file_id = data.get('file_id')
    
    if not session_id or session_id not in session_files:
        return jsonify({'status': 'error', 'message': 'Invalid session'}), 400
    
    # Find and remove the file
    for i, file_info in enumerate(session_files[session_id]):
        if file_info['id'] == file_id:
            # Remove from session
            session_files[session_id].pop(i)
            return jsonify({'status': 'success', 'message': 'File removed'})
    
    return jsonify({'status': 'error', 'message': 'File not found'}), 404

@app.route('/clear', methods=['POST'])
def clear_files():
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in session_files:
        return jsonify({'status': 'error', 'message': 'Invalid session'}), 400
    
    # Clear the session
    session_files[session_id] = []
    
    return jsonify({'status': 'success', 'message': 'All files cleared'})

@app.route('/merge', methods=['POST'])
def merge_pdfs():
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in session_files:
        return jsonify({'status': 'error', 'message': 'Invalid session'}), 400
    
    if not session_files[session_id]:
        return jsonify({'status': 'error', 'message': 'No files to merge'}), 400
    
    try:
        # Create merger
        merger = PdfMerger()
        
        # Add all PDFs from memory
        for file_info in session_files[session_id]:
            merger.append(io.BytesIO(file_info['data']))
        
        # Create BytesIO object to store the merged PDF
        merged_pdf = io.BytesIO()
        
        # Write to BytesIO object
        merger.write(merged_pdf)
        merger.close()
        
        # Store the merged PDF in the session
        merged_pdf.seek(0)
        session_files[session_id] = [{'merged_pdf': merged_pdf}]
        
        return jsonify({
            'status': 'success', 
            'message': 'PDFs merged successfully'
        })
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error: {str(e)}'}), 500

@app.route('/download', methods=['POST'])
def download_file():
    data = request.json
    session_id = data.get('session_id')
    filename = data.get('filename', 'merged.pdf')
    
    if not session_id or session_id not in session_files:
        return jsonify({'status': 'error', 'message': 'Invalid session'}), 400
    
    if not session_files[session_id] or 'merged_pdf' not in session_files[session_id][0]:
        return jsonify({'status': 'error', 'message': 'No merged PDF found'}), 404
    
    # Ensure filename ends with .pdf
    if not filename.lower().endswith('.pdf'):
        filename = filename + '.pdf'
    
    # Create a download token
    download_token = str(uuid.uuid4())
    session_files[session_id][0]['download_token'] = download_token
    
    return jsonify({
        'status': 'success',
        'download_token': download_token
    })

@app.route('/download/<session_id>/<download_token>/<filename>', methods=['GET'])
def serve_file(session_id, download_token, filename):
    if session_id not in session_files:
        return "Session not found", 404
    
    if not session_files[session_id] or 'merged_pdf' not in session_files[session_id][0]:
        return "File not found", 404
    
    if 'download_token' not in session_files[session_id][0] or session_files[session_id][0]['download_token'] != download_token:
        return "Invalid download token", 403
    
    # Get the BytesIO object
    merged_pdf = session_files[session_id][0]['merged_pdf']
    merged_pdf.seek(0)
    
    return send_file(
        merged_pdf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename
    )

if __name__ == '__main__':
    app.run(debug=True)