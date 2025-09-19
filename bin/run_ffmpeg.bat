@echo off
C:\Users\chint\Desktop\Ai-content-automation\node_modules\ffmpeg-static\ffmpeg.exe ^
-i videos/Base-vedio.mp4 ^
-i audio/trump-claims-modi-call-ended-india-pakistan-standoff-in-5-hours-prevented-nucle_PqvymKxf.mp3 ^
-i images/test_image_1.png ^
-i images/test_image_2.png ^
-i images/test_image_3.png ^
-i images/test_image_4.png ^
-i images/test_image_5.png ^
-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base];[2:v]scale=1000:500:force_original_aspect_ratio=decrease,pad=1000:500:(ow-iw)/2:(oh-ih)/2:black[img0];[3:v]scale=1000:500:force_original_aspect_ratio=decrease,pad=1000:500:(ow-iw)/2:(oh-ih)/2:black[img1];[4:v]scale=1000:500:force_original_aspect_ratio=decrease,pad=1000:500:(ow-iw)/2:(oh-ih)/2:black[img2];[5:v]scale=1000:500:force_original_aspect_ratio=decrease,pad=1000:500:(ow-iw)/2:(oh-ih)/2:black[img3];[6:v]scale=1000:500:force_original_aspect_ratio=decrease,pad=1000:500:(ow-iw)/2:(oh-ih)/2:black[img4];[base][img0]overlay=40:200:enable=between(t\,0\,10)[v0];[v0][img1]overlay=40:200:enable=between(t\,10\,20)[v1];[v1][img2]overlay=40:200:enable=between(t\,20\,30)[v2];[v2][img3]overlay=40:200:enable=between(t\,30\,40)[v3];[v3][img4]overlay=40:200:enable=between(t\,40\,50)[v4];[v4]subtitles=subtitles/test_subtitles_utf8.srt:force_style='FontName=Verdana,FontSize=12,Bold=1,PrimaryColour=&H00FFFFFF&,BackColour=&H80000000&,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=20'[final]" ^
-map "[final]" -map 1:a -af volume=10.0 -c:v libx264 -c:a aac -b:a 192k -shortest final_smallsubs.mp4
pause
