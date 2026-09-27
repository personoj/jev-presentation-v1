from pathlib import Path
import subprocess, json, os, sys
ROOT=Path(__file__).resolve().parents[2]
FFMPEG=Path('D:/conda/envs_dirs/codex/npm-global/node_modules/ffmpeg-static/ffmpeg.exe')
FFPROBE=Path('D:/conda/envs_dirs/codex/npm-global/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')
for group in sys.argv[1:]:
    folder=ROOT/'production'/group
    video=folder/'master.mp4'
    probe=json.loads(subprocess.check_output([str(FFPROBE),'-v','error','-show_streams','-show_format','-of','json',str(video)]))
    (folder/'source-probe.json').write_text(json.dumps(probe,indent=2),encoding='utf8')
    stream=next(s for s in probe['streams'] if s['codec_type']=='video')
    w,h=stream['width'],stream['height']
    source=video
    if (w,h)==(1344,768):
        source=folder/'master-16x9.mp4'
        subprocess.run([str(FFMPEG),'-y','-v','error','-i',str(video),'-vf','crop=1344:756:0:6','-c:v','libx264','-crf','15','-preset','slow','-an',str(source)],check=True)
        w,h=1344,756
    elif abs(w/h-16/9)>0.001:
        raise RuntimeError(f'Unexpected aspect ratio {w}x{h}; review required')
    subprocess.run([str(FFMPEG),'-y','-v','error','-i',str(source),'-vf','fps=4,scale=336:-1,tile=5x4','-frames:v','1',str(folder/'contact.jpg')],check=True)
    subprocess.run([str(FFMPEG),'-y','-v','error','-sseof','-0.05','-i',str(source),'-frames:v','1',str(folder/'actual-tail.png')],check=True)
    subprocess.run([str(FFMPEG),'-y','-v','error','-i',str(source),'-frames:v','1',str(folder/'actual-first.png')],check=True)
    print(json.dumps({'group':group,'sourceSize':[stream['width'],stream['height']],'preparedSize':[w,h],'fps':stream['r_frame_rate'],'frames':stream.get('nb_frames'),'duration':probe['format']['duration'],'prepared':str(source)},ensure_ascii=False))
