from pathlib import Path
import subprocess,json
ROOT=Path(__file__).resolve().parent
FFMPEG='D:/conda/envs_dirs/codex/npm-global/node_modules/ffmpeg-static/ffmpeg.exe'
FFPROBE='D:/conda/envs_dirs/codex/npm-global/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'
probe=json.loads(subprocess.check_output([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(ROOT/'master-v2.mp4')]))
(ROOT/'source-probe-v2.json').write_text(json.dumps(probe,indent=2),encoding='utf8')
stream=next(s for s in probe['streams'] if s['codec_type']=='video')
w,h=stream['width'],stream['height']
source=ROOT/'master-v2.mp4'
if (w,h)==(1344,768):
    source=ROOT/'master-v2-16x9.mp4'
    subprocess.run([FFMPEG,'-y','-v','error','-i',str(ROOT/'master-v2.mp4'),'-vf','crop=1344:756:0:6','-c:v','libx264','-crf','15','-preset','slow','-an',str(source)],check=True)
elif abs(w/h-16/9)>0.001:raise RuntimeError(f'Unexpected ratio {w}x{h}')
subprocess.run([FFMPEG,'-y','-v','error','-i',str(source),'-vf','fps=4,scale=336:-1,tile=5x4','-frames:v','1',str(ROOT/'contact-v2.jpg')],check=True)
subprocess.run([FFMPEG,'-y','-v','error','-i',str(source),'-vf','scale=160:-1,tile=8x16','-frames:v','1',str(ROOT/'all-frames-v2.jpg')],check=True)
subprocess.run([FFMPEG,'-y','-v','error','-sseof','-0.05','-i',str(source),'-frames:v','1',str(ROOT/'actual-tail-v2.png')],check=True)
print(json.dumps({'size':[w,h],'fps':stream['r_frame_rate'],'frames':stream.get('nb_frames'),'duration':probe['format']['duration']}))
