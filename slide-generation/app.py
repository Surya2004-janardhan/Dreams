from flask import Flask, request, send_file, after_this_request
from PIL import Image, ImageDraw, ImageFont
import io
import os
import textwrap

app = Flask(__name__)

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    title = data['title']
    content = ' '.join(data['content'].split())  # Increased to 40 words
    
    # Create image
    img = Image.open('assets/Post-Base-Image.png')
    draw = ImageDraw.Draw(img)
    width, height = img.size
    
    # Fonts
    try:
        font_title = ImageFont.truetype("timesbd.ttf", 61)  # Serif bold
        font_content = ImageFont.truetype("times.ttf", 57)  # Classic serif
    except:
        font_title = ImageFont.load_default()
        font_content = ImageFont.load_default()
    
    # Title: dark grey, center
    bbox_title = draw.textbbox((0, 0), title, font=font_title)
    title_width = bbox_title[2] - bbox_title[0]
    title_x = (width - title_width) / 2
    title_y = 0.05 * height  # 5% top margin
    draw.text((title_x, title_y), title, fill=(64, 64, 64), font=font_title)
    # Underline title
    underline_y = title_y + 61 + 2  # Below the text
    draw.line([title_x, underline_y, title_x + title_width, underline_y], fill=(64, 64, 64), width=2)
    
    # Content: dark black, left-aligned, wrap text, 15% top margin
    left_margin = 0.13 * width  # Increased by 2%
    right_margin = 0.92 * width  # Increased by 1%
    available_width = right_margin - left_margin
    avg_char_width = 51 / 2  # Rough estimate for arial 51pt
    wrap_width = int(available_width / avg_char_width)
    wrapped_content = textwrap.wrap(content, width=wrap_width, break_long_words=True)
    content_y_start = 0.17 * height  # Increased by 2%
    line_height = 51 * 1.236  # Increased by 1%
    for line in wrapped_content:
        content_x = left_margin
        draw.text((content_x, content_y_start), line, fill=(0, 0, 0), font=font_content)
        content_y_start += line_height
    
    # Draw box around content area to show margins
    # draw.rectangle([left_margin + 2, 0.17*height + 2, right_margin - 2, 0.9*height - 2], outline="red", width=2)
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    # Return image
    return send_file(img_bytes, mimetype='image/png', as_attachment=True, download_name='Post-Image.png')

if __name__ == '__main__':
    app.run()