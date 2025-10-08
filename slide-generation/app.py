from flask import Flask, request, send_file
import io
import os
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/')
def home():
    return "Slide Generation API is running!"

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    title = data['title']
    content = data['content']
    
    # API Template configuration
    api_key = os.environ.get('API_TEMPLATE_API_KEY')
    template_id ='a6277b23e8254d54'
    
    if not api_key or not template_id:
        return {"error": "API credentials not configured"}, 500
    
    payload = {
        
  
  "overrides": [
    {
      "name": "rect-image_1",
      "stroke": "grey",
      "src": "https://apitemplateio-user.s3-ap-southeast-1.amazonaws.com/39821/53500/b6c42c55-e5e9-4bb1-a365-6551b386fa33.jpg"
    },
    {
      "name": "text_1",
      "text": "@async_await._",
      "textBackgroundColor": "rgba(0, 0, 0, 0)",
      "color": "rgba(234, 227, 227, 0.33)"
    },
    {
      "name": "text_2",
      "text": title,
      "textBackgroundColor": "#141111",
      "color": "#BAB9BE"
    },
    {
      "name": "text_3",
      "text": content,
      "textBackgroundColor": "rgba(0, 0, 0, 0)",
      "color": "#ffffff"
    }
  ]


    }
    
    # Call API Template API
    url = f"https://rest.apitemplate.io/v2/create-image?template_id={template_id}"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        # Get the image download URL
        image_url = result.get('download_url')
        if not image_url:
            return {"error": "No download URL in response"}, 500
        
        # Fetch the generated image
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        
        # Return the image
        return send_file(io.BytesIO(img_response.content), mimetype='image/png', as_attachment=True, download_name='Post-Image.png')
    
    except requests.RequestException as e:
        print(f"API Error: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"Response status: {e.response.status_code}")
            print(f"Response text: {e.response.text}")
        return {"error": f"API request failed: {str(e)}"}, 500

if __name__ == '__main__':
    app.run()