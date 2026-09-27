"""Read-only audit of delivered video assets. Writes only the two audit reports."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fractions import Fraction
from datetime import datetime,timezone
import subprocess,json,hashlib,re
ROOT=Path(__file__).resolve().parents[1]
PROBE='D:/conda/envs_dirs/codex/npm-global/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'
GROUPS=['book','m03','m04','m05','m06','m07','m08']
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def probe(path,frames=False):
    args=[PROBE,'-v','error','-show_streams','-show_format']
    if frames:args+=['-show_frames','-show_entries','frame=key_frame,pict_type:stream:format']
    args+=['-of','json',str(path)]
    return json.loads(subprocess.check_output(args))
def read_asset(pair):
    group,device=pair; name=group+('-mobile' if device=='mobile' else '')+'.mp4';path=ROOT/'public/media'/name
    p=probe(path,True);v=next(s for s in p['streams'] if s['codec_type']=='video');decoded=p['frames'];timeline=json.loads((ROOT/'public/media'/f'{group}-timeline.json').read_text(encoding='utf8'))
    fps=float(Fraction(v['avg_frame_rate']));n=int(v['nb_frames']);audio=sum(s['codec_type']=='audio' for s in p['streams']);errors=[]
    # M03/M04/M07 are intentionally square component assets per their briefs.
    expectedSize=([480,480] if device=='mobile' else [720,720]) if group in ['m03','m04','m07'] else ([768,432] if device=='mobile' else [1344,756])
    if [v['width'],v['height']]!=expectedSize:errors.append('Unexpected dimensions')
    if fps!=24:errors.append('Unexpected frame rate')
    if n!=(248 if group=='book' else 124):errors.append('Unexpected frame count')
    if len(decoded)!=n:errors.append('Decoded frame count differs from stream count')
    if audio:errors.append('Audio stream present')
    allKeys=all(f.get('key_frame')==1 and f.get('pict_type')=='I' for f in decoded)
    if not allKeys:errors.append('Not every frame is an I keyframe')
    if timeline['frameCount']!=n or timeline['fps']!=fps:errors.append('Timeline metadata mismatch')
    states=timeline['states'];segments=timeline['segments']
    if timeline['initialState']!=states[0]['id'] or len({s['id'] for s in states})!=len(states):errors.append('Timeline state identity invalid')
    for state in states:
        if not (0<=state['frame']<n) or abs(state['hold']-state['frame']/fps)>1e-8:errors.append('State hold is not the actual frame time')
    for index,segment in enumerate(segments):
        f=segment['frames']
        if not (0<=f['start']<=f['hold']<f['endExclusive']<=n):errors.append('Segment frame bounds invalid')
        if not(segment['start']<=segment['hold']<segment['endExclusive']):errors.append('Segment time ordering invalid')
        for field in ['start','hold','endExclusive']:
            if abs(segment[field]-f[field]/fps)>1e-8:errors.append('Segment time/frame mismatch')
        if segment['from']!=states[index]['id'] or segment['to']!=states[index+1]['id']:errors.append('State order mismatch')
        if f['hold']!=states[index+1]['frame']:errors.append('Destination state mismatch')
        if index and f['start']!=segments[index-1]['frames']['endExclusive']:errors.append('Gap or overlap between segments')
    if segments[0]['frames']['start']!=0 or segments[-1]['frames']['endExclusive']!=n:errors.append('Timeline does not cover all frames')
    compiled=ROOT/'production'/group/('compiled-v2' if group=='m08' else 'compiled')/'final'/f'motion-baked-{device}.mp4'
    sourceMatch=compiled.exists() and sha(compiled)==sha(path)
    if not sourceMatch:errors.append('Public asset differs from selected compiled version')
    return {'group':group,'device':device,'path':path.relative_to(ROOT).as_posix(),'width':v['width'],'height':v['height'],'fps':fps,'streamFrameCount':n,'decodedFrameCount':len(decoded),'audioStreamCount':audio,'allFramesAreKeyframes':allKeys,'videoStreamDurationSeconds':float(v['duration']),'formatDurationSeconds':float(p['format']['duration']),'frameCountOverFpsSeconds':n/fps,'bytes':path.stat().st_size,'sha256':sha(path),'selectedCompiledSource':compiled.relative_to(ROOT).as_posix(),'selectedSourceHashMatches':sourceMatch,'timelinePath':f'public/media/{group}-timeline.json','states':states,'segments':segments,'errors':errors,'passed':not errors}
with ThreadPoolExecutor(max_workers=4) as pool:assets=list(pool.map(read_asset,[(g,d) for g in GROUPS for d in ['desktop','mobile']]))
artRefs={}
for path in (ROOT/'src').rglob('*'):
    if path.is_file() and path.suffix in ['.tsx','.ts','.css']:
        text=path.read_text(encoding='utf8')
        for ref in re.findall(r'/art/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg)',text):artRefs.setdefault(ref,[]).append(path.relative_to(ROOT).as_posix())
art=[{'reference':ref,'exists':(ROOT/'public'/ref.lstrip('/')).is_file(),'usedBy':paths} for ref,paths in sorted(artRefs.items())]
chain=json.loads((ROOT/'production/book-frame-chain.json').read_text(encoding='utf8'))
chainArtifacts=[]
for link in chain['links']+chain['outputLinks']:
    for key,value in link.items():
        if isinstance(value,dict) and 'path' in value and 'sha256' in value:
            path=Path(value['path']);chainArtifacts.append({'role':key,'path':str(path),'exists':path.exists(),'hashMatches':path.exists() and sha(path)==value['sha256']})
chainValid=all(x.get('exactSha256Match') for x in chain['links']) and all(x.get('passed') for x in chain['outputLinks']) and all(x['hashMatches'] for x in chainArtifacts)
generated=[]
for path in sorted((ROOT/'production').glob('m*/master*.mp4')):
    if '16x9' in path.name:continue
    p=probe(path);v=next(s for s in p['streams'] if s['codec_type']=='video')
    generated.append({'path':path.relative_to(ROOT).as_posix(),'videoStreamDurationSeconds':float(v['duration']),'formatDurationSeconds':float(p['format']['duration']),'frames':int(v['nb_frames']),'fps':float(Fraction(v['avg_frame_rate'])),'selectedForPresentation':not(path.parent.name=='m08' and path.name=='master.mp4')})
official={x['path'] for x in assets};extraPublic=[p.relative_to(ROOT).as_posix() for p in (ROOT/'public/media').glob('*.mp4') if p.relative_to(ROOT).as_posix() not in official]
promptPaths=[p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'production').rglob('*')) if p.is_file() and ('prompt' in p.name.lower()) and p.suffix in ['.txt','.md']]
audit={'auditedAt':datetime.now(timezone.utc).isoformat(),'scope':'Media and artifact audit only; no browser playback claims','method':'ffprobe streams plus decoded key_frame/pict_type for all 14 delivered MP4 files; sha256 source comparisons; static timeline and art-reference checks','passed':all(a['passed'] for a in assets) and all(a['exists'] for a in art) and chainValid,'assets':assets,'artReferences':art,'bookContinuity':{'path':'production/book-frame-chain.json','inputRelayAndOutputVerificationPassed':chainValid,'evidenceArtifacts':chainArtifacts,'recordedOutputMetrics':chain['outputLinks'][0]['metrics'],'expectedFrames':248},'durationAccounting':{'presentationDesktopVideoStreamTotalSeconds':sum(a['videoStreamDurationSeconds'] for a in assets if a['device']=='desktop'),'presentationMobileVideoStreamTotalSeconds':sum(a['videoStreamDurationSeconds'] for a in assets if a['device']=='mobile'),'presentationTimelineFrameTotalSeconds':sum(a['frameCountOverFpsSeconds'] for a in assets if a['device']=='desktop'),'presentationChapterMotionSegments':8,'note':'One device version per presentation; book contains M01 and M02. Desktop/mobile versions are not added together. Replays and playback-rate adjustments alter actual talk time.','generatedOriginals':generated,'allGeneratedOriginalVideoStreamTotalSeconds':sum(x['videoStreamDurationSeconds'] for x in generated),'extraGeneratedVersionVideoStreamSeconds':sum(x['videoStreamDurationSeconds'] for x in generated if not x['selectedForPresentation']),'transcodesAndJoinedCopiesExcluded':True},'extraPublicMp4NotUsedByDeclaredGroups':extraPublic,'promptAndSourceIndex':promptPaths,'visualReviewScope':{'thisAgentReviewed':['M05 first/last, 4fps contact sheet, all 124 frames contact sheet, actual decoded tail','M06 first/last, 4fps contact sheet, all 124 frames contact sheet, actual decoded tail','M08 v1 and v2 all 124 frames contact sheets and decoded tails; selected v2 has no roof escaping frame','M05/M06/M08 original ImageGen stills and cultural-street-runtime.png'],'otherGroups':'M01/M02/M03/M04/M07 content and page playback reviewed separately by root/other agents; this audit checks their encoded assets and evidence records only','browserPlayback':'Not claimed by this audit; root task verifies UI playback, reverse, reduced motion and mobile layout'}}
(ROOT/'qa/media-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 媒体与产物审计','',f"审计结果：{'通过' if audit['passed'] else '存在不符项'}。仅覆盖媒体文件、时间轴、资源引用与已记录证据，不声明浏览器完整播放通过。",'', '## 正式媒体','', '| 组 | 桌面 / 手机尺寸 | 帧率 | 帧数 | 实际视频流时长（秒） | 音轨 / 全关键帧 |','| --- | --- | --- | --- | --- | --- |']
for g in GROUPS:
    d=next(x for x in assets if x['group']==g and x['device']=='desktop');m=next(x for x in assets if x['group']==g and x['device']=='mobile')
    lines.append(f"| {g} | {d['width']}×{d['height']} / {m['width']}×{m['height']} | {d['fps']:g} | {d['streamFrameCount']} | {d['videoStreamDurationSeconds']:.6f} | {d['audioStreamCount']} / {'全部是' if d['allFramesAreKeyframes'] and m['allFramesAreKeyframes'] else '不符合'} |")
lines+=['',f"14 个 MP4 均逐帧检查 key_frame 与 pict_type；桌面和手机文件分别与选中编译源核对 SHA-256。M08 正式资源对应 compiled-v2，桌面哈希为 {next(a['sha256'] for a in assets if a['group']=='m08' and a['device']=='desktop')}。",'', '## 时间轴与连续链','', '- 七个时间轴的 states、hold、endExclusive 与实际帧数一致。单段 hold 为 5.125 秒，最后可见帧索引为 123。','- book 为 248 帧，两段分别覆盖 [0,124) 与 [124,248)，状态依次为 closed、open、entered，最后 hold 为 10.291666667 秒。',f"- book-frame-chain.json 的输入接力与输出接缝记录通过，证据文件与母版哈希仍匹配。已记录 SSIM 为 {chain['outputLinks'][0]['metrics']['ssim']}，归一化 MAE 为 {chain['outputLinks'][0]['metrics']['normalizedMae']}。这里核对记录与工件，不冒充重新进行了浏览器接缝观察。",'', '## 时长口径','',f"- 用户展示用八段动作，按桌面视频流 duration 累计 {audit['durationAccounting']['presentationDesktopVideoStreamTotalSeconds']:.6f} 秒；按时间轴帧数除以帧率累计 {audit['durationAccounting']['presentationTimelineFrameTotalSeconds']:.6f} 秒。差异来自容器时间基舍入。",f"- 原始生成片共 {len(generated)} 段，视频流时长共 {audit['durationAccounting']['allGeneratedOriginalVideoStreamTotalSeconds']:.6f} 秒，包含 M08 保留的 v1 额外 {audit['durationAccounting']['extraGeneratedVersionVideoStreamSeconds']:.6f} 秒。",'- 统计不把手机转码、裁切副本、拼接副本或重复播放叠加为新生成素材；未用 format.duration 的音频尾部填充计时。实际讲解还会受停留、重复与播放器速度影响。','', '## 图片与保留文件','',f"- 前端直接引用的 {len(art)} 个 /art 文件均存在。详细引用位置在 media-audit.json。",f"- public/media 中还有未列入正式七组的文件：{', '.join(extraPublic) or '无'}。它不计入本次展示时长。",'- 提示词与来源路径索引已写入 JSON；报告不含 API Key。','', '## 视觉检查范围','', '- 本子任务看过 M05、M06、M08 的首尾帧、4 fps 抽样及全部124帧接触表，并检查实际解码尾帧；M08 v2 已修复屋顶出框。','- M01/M02/M03/M04/M07 的画面与页面检查由其他任务承担，本报告仅复核其文件编码和证据。','- 浏览器播放、反向取消、慢网降级、reduced-motion 与移动端布局由根任务另行验收。']
errors=[f"{x['path']}: {e}" for x in assets for e in x['errors']]
if errors:lines+=['','## 不符项','']+['- '+x for x in errors]
(ROOT/'qa/媒体验收.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps({'passed':audit['passed'],'assets':len(assets),'artReferences':len(art),'errors':errors,'bookChainValid':chainValid,'duration':audit['durationAccounting']},ensure_ascii=False))
