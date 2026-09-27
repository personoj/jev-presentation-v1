from pathlib import Path
import subprocess, json, os, sys, shutil
ROOT=Path(__file__).resolve().parents[2]
SKILL=ROOT.parent/'.agents/skills/oil-motion/scripts'
env=os.environ.copy();env['PYTHONIOENCODING']='utf-8'
env['PATH']=os.pathsep.join(['D:/conda/envs_dirs/codex/npm-global/node_modules/ffmpeg-static','D:/conda/envs_dirs/codex/npm-global/node_modules/ffprobe-static/bin/win32/x64',env.get('PATH','')])
for group in sys.argv[1:]:
    folder=ROOT/'production'/group
    probe=json.loads((folder/'source-probe.json').read_text())
    stream=next(s for s in probe['streams'] if s['codec_type']=='video')
    source=folder/'master-16x9.mp4'
    if not source.exists():source=folder/'master.mp4'
    w,h=(1344,756) if source.name=='master-16x9.mp4' else (stream['width'],stream['height'])
    frames=int(stream['nb_frames']); fps=stream['r_frame_rate'].split('/');rate=float(fps[0])/float(fps[1])
    subprocess.run([sys.executable,str(SKILL/'motion_budget.py'),'--frames',str(frames),'--display','1100x619','--dpr','1','--driver','state','--parameter-space','linear','--time-control','segment-play','--access','sequential','--background-owner','video','--source',f'{w}x{h}','--report',str(folder/'motion-budget.json'),'--strict'],env=env,check=True)
    subprocess.run([sys.executable,str(SKILL/'compile_scroll_video.py'),str(source),str(folder/'compiled'),'--background-owner','video','--budget-report',str(folder/'motion-budget.json'),'--frame-policy','native','--fps',str(rate),'--timeline-output',str(folder/'timeline.json'),'--desktop-width',str(w),'--mobile-width','768','--initial-state-id',group+'-first','--segment',f'{group}-last=0:{frames-1}:{frames}','--poster-source-frame',str(frames-1)],env=env,check=True)
    compiled=folder/'compiled'
    report=json.loads((compiled/'compile.json').read_text(encoding='utf8'))
    print(json.dumps({'group':group,'compiled':str(compiled),'topKeys':list(report)},ensure_ascii=False))
