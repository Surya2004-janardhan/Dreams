from flask import Flask, request, send_file, after_this_request
from PIL import Image, ImageDraw, ImageFont
import io
import os
import textwrap
import logging
import shutil

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_fonts():
    """Copy Times New Roman and Montserrat fonts to assets directory if available"""
    assets_dir = os.path.join(os.path.dirname(__file__), 'assets')
    fonts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
    os.makedirs(assets_dir, exist_ok=True)
    
    # Copy Montserrat fonts from fonts directory to assets
    montserrat_fonts = ["Montserrat-Bold.ttf", "Montserrat-Black.ttf", "Montserrat-Medium.ttf", "Montserrat-Light.ttf"]
    for font in montserrat_fonts:
        src_path = os.path.join(fonts_dir, font)
        dest_path = os.path.join(assets_dir, font)
        if os.path.exists(src_path) and not os.path.exists(dest_path):
            try:
                shutil.copy2(src_path, dest_path)
                logger.info(f"Copied Montserrat font from {src_path} to {dest_path}")
            except Exception as e:
                logger.warning(f"Failed to copy Montserrat font {src_path}: {e}")
    
    # Possible system font locations
    system_font_paths = [
        "C:/Windows/Fonts/timesbd.ttf",  # Windows
        "C:/Windows/Fonts/times.ttf",    # Windows
        "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman_Bold.ttf",  # Linux
        "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf",       # Linux
        "/System/Library/Fonts/Times New Roman Bold.ttf",  # macOS
        "/System/Library/Fonts/Times New Roman.ttf",       # macOS
    ]
    
    font_copies = [
        ("timesbd.ttf", "times_new_roman_bold.ttf"),
        ("times.ttf", "times_new_roman.ttf"),
        ("Times_New_Roman_Bold.ttf", "times_new_roman_bold.ttf"),
        ("Times_New_Roman.ttf", "times_new_roman.ttf"),
    ]
    
    for system_path in system_font_paths:
        if os.path.exists(system_path):
            # Determine destination filename
            basename = os.path.basename(system_path).lower()
            dest_name = "times_new_roman_bold.ttf" if "bold" in basename or "bd" in basename else "times_new_roman.ttf"
            dest_path = os.path.join(assets_dir, dest_name)
            
            if not os.path.exists(dest_path):
                try:
                    shutil.copy2(system_path, dest_path)
                    logger.info(f"Copied font from {system_path} to {dest_path}")
                except Exception as e:
                    logger.warning(f"Failed to copy font {system_path}: {e}")
            else:
                logger.info(f"Font already exists: {dest_path}")

# Setup fonts on startup
setup_fonts()

@app.route('/')
def home():
    return "Slide Generation API is running!"

@app.route('/font-status')
def font_status():
    """Check font loading status"""
    assets_dir = os.path.join(os.path.dirname(__file__), 'assets')
    fonts_status = {
        "assets_dir": assets_dir,
        "fonts_found": []
    }
    
    font_files = ["Montserrat-Bold.ttf", "Montserrat-Light.ttf", "PlayfairDisplay-Regular.ttf", "times_new_roman_bold.ttf", "times_new_roman.ttf"]
    for font_file in font_files:
        font_path = os.path.join(assets_dir, font_file)
        fonts_status["fonts_found"].append({
            "name": font_file,
            "path": font_path,
            "exists": os.path.exists(font_path)
        })
    
    return fonts_status

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    title = data['title']
    content = ' '.join(data['content'].split())  # Increased to 40 words
    
    # Create image
    img = Image.open('assets/Post-Base-Image.png')
    logger.info(f"Using base image: assets/Post-Base-Image.png")
    width, height = img.size
    logger.info(f"Image dimensions: {width}x{height}")
    draw = ImageDraw.Draw(img)
    
    # Fonts - Use Montserrat fonts with multiple fallback options
    font_title = None
    font_content = None
    
    # Paths to font directories
    assets_dir = os.path.join(os.path.dirname(__file__), 'assets')
    fonts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
    
    # First try Montserrat fonts
    local_font_options = [
        (os.path.join(assets_dir, "Montserrat-Bold.ttf"), 47),  # Title font (increased by 4px)
        (os.path.join(assets_dir, "Montserrat-Light.ttf"), 24),  # Content font
    ]
    
    # Try different Montserrat font paths and names
    system_font_options = [
        ("Montserrat-Bold.ttf", 47),  # Local assets (increased by 4px)
        ("Montserrat-Light.ttf", 24),  # Local assets
        ("timesbd.ttf", 38),           # Windows standard fallback
        ("times.ttf", 18),             # Windows standard fallback
        ("Times New Roman Bold.ttf", 38),  # Alternative name fallback
        ("Times New Roman.ttf", 18),       # Alternative name fallback
        ("/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman_Bold.ttf", 38),  # Linux fallback
        ("/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf", 18),       # Linux fallback
        ("/System/Library/Fonts/Times New Roman Bold.ttf", 38),  # macOS fallback
        ("/System/Library/Fonts/Times New Roman.ttf", 18),       # macOS fallback
    ]
    
    all_font_options = local_font_options + system_font_options
    
    # Load title font (try Alan Sans Bold first, then fallbacks)
    for font_path, size in all_font_options:
        try:
            font_title = ImageFont.truetype(font_path, size)
            logger.info(f"✅ Successfully loaded title font: {font_path} (size: {size})")
            break
        except OSError as e:
            logger.warning(f"❌ Failed to load title font: {font_path} (size: {size}) - {e}")
            continue
    
    # Load content font (same font, smaller size)
    for font_path, size in all_font_options:
        try:
            font_content = ImageFont.truetype(font_path, size)
            logger.info(f"✅ Successfully loaded content font: {font_path} (size: {size})")
            break
        except OSError as e:
            logger.warning(f"❌ Failed to load content font: {font_path} (size: {size}) - {e}")
            continue
    
    # Final fallback to default fonts
    if font_title is None:
        font_title = ImageFont.load_default()
        logger.warning("Montserrat Bold font not found, using default font for title")
    
    if font_content is None:
        font_content = ImageFont.load_default()
        logger.warning("Montserrat Light font not found, using default font for content")
    
    # Title: dark grey, center
    bbox_title = draw.textbbox((0, 0), title, font=font_title)
    title_width = bbox_title[2] - bbox_title[0]
    title_x = (width - title_width) / 2
    title_y = 0.09 * height  # 9% top margin (increased by 3%)
    draw.text((title_x, title_y), title, fill=(64, 64, 64), font=font_title)
    # Underline title
    underline_y = title_y + 38 + 4  # Below the text (updated for new font size)
    draw.line([title_x, underline_y, title_x + title_width, underline_y], fill=(64, 64, 64), width=2)
    
    # Content: dark black, left-aligned, wrap text, 15% top margin
    left_margin = 0.16 * width  # Increased by 3% (from 13% to 16%)
    right_margin = 0.92 * width  # Increased by 1%
    available_width = right_margin - left_margin
    avg_char_width = 51 / 2  # Rough estimate for arial 51pt
    wrap_width = int(available_width / avg_char_width)
    wrapped_content = textwrap.wrap(content, width=wrap_width, break_long_words=True)
    content_y_start = 0.22 * height  # Increased by 5% (from 17% to 22%)
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