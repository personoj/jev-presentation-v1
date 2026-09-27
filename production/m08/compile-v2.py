from pathlib import Path
import subprocess,json,os,sys
FOLDER=Path(__file__).resolve().parent
ROOT=FOLDER.parents[1]
SKILL=ROOT.parent/'.agents/skills/oil-motion/scripts'
env=os.environ.copy();env['PYTHONIOENCODING']='utf-8'
env['PATH']=os.pathsep.join(['D:/conda/envs_dirs/codex/npm-global/node_modules/ffmpeg-static','D:/conda/envs_dirs/codex/npm-global/node_modules/ffprobe-static/bin/win32/x64',env.get('PATH','')])
probe=json.loads((FOLDER/'source-probe-v2.json').read_text())
stream=next(s for s in probe['streams'] if s['codec_type']=='video')
frames=int(stream['nb_frames']);fpsparts=stream['r_frame_rate'].split('/');fps=float(fpsparts[0])/float(fpsparts[1])
source=FOLDER/'master-v2-16x9.mp4'
if not source.exists():source=FOLDER/'master-v2.mp4'
w,h=(1344,756) if source.name=='master-v2-16x9.mp4' else (stream['width'],stream['height'])
subprocess.run([sys.executable,str(SKILL/'motion_budget.py'),'--frames',str(frames),'--display','1100x619','--dpr','1','--driver','state','--parameter-space','linear','--time-control','segment-play','--access','sequential','--background-owner','video','--source',f'{w}x{h}','--report',str(FOLDER/'motion-budget-v2.json'),'--strict'],env=env,check=True)
subprocess.run([sys.executable,str(SKILL/'compile_scroll_video.py'),str(source),str(FOLDER/'compiled-v2'),'--background-owner','video','--budget-report',str(FOLDER/'motion-budget-v2.json'),'--frame-policy','native','--fps',str(fps),'--timeline-output',str(FOLDER/'timeline-v2.json'),'--desktop-width',str(w),'--mobile-width','768','--initial-state-id','m08-first','--segment',f'm08-last=0:{frames-1}:{frames}','--poster-source-frame',str(frames-1)],env=env,check=True)
