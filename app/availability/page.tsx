"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Slot = { hour: number; startsAt: number; available: boolean };
type Reservation = { id:string; studioId:string; startsAt:number; endsAt:number; status:"CONFIRMED"|"CANCELLED"|"COMPLETED" };
declare global { interface Window { liff?: { init(c:{liffId:string}):Promise<void>; isLoggedIn():boolean; login(c?:{redirectUri?:string}):void; getAccessToken():string|null } } }
function dateText(date:string){return new Intl.DateTimeFormat("ja-JP",{month:"long",day:"numeric",weekday:"short",timeZone:"Asia/Tokyo"}).format(new Date(`${date}T12:00:00+09:00`))}
function hourText(hour:number){return hour < 24 ? `${hour}:00` : `翌${hour-24}:00`}
const ITEM_HEIGHT=72;

export default function AvailabilityPage(){
  const today=useMemo(()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(new Date()),[]);
  const limit=useMemo(()=>{const d=new Date(`${today}T00:00:00+09:00`);d.setMonth(d.getMonth()+1);return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(d)},[today]);
  const [date,setDate]=useState(today),[slots,setSlots]=useState<Slot[]>([]),[loading,setLoading]=useState(true),[selected,setSelected]=useState<number|null>(null),[duration,setDuration]=useState(1),[notice,setNotice]=useState(""),[reservations,setReservations]=useState<Reservation[]>([]),[token,setToken]=useState<string|null>(null);
  const wheelRef=useRef<HTMLDivElement>(null),scrollTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{setLoading(true);setSelected(null);fetch(`/api/v1/availability?date=${date}`).then(r=>r.json()).then(x=>setSlots(x.slots??[])).catch(()=>setNotice("空き状況を取得できませんでした")).finally(()=>setLoading(false))},[date]);
  function authHeaders(json=false){const headers:Record<string,string>={};if(json)headers["Content-Type"]="application/json";if(token)headers.Authorization=`Bearer ${token}`;else headers["X-Compass-Preview"]="representative";return headers}
  async function loadReservations(accessToken:string|null=token){const headers:Record<string,string>=accessToken?{Authorization:`Bearer ${accessToken}`}:{"X-Compass-Preview":"representative"};const response=await fetch("/api/v1/reservations",{headers});if(response.ok)setReservations((await response.json()).reservations??[])}
  useEffect(()=>{loadReservations(null)},[]);
  const maxDuration=selected==null?1:Math.min(10,26-selected,...Array.from({length:10},(_,i)=>i+1).filter(h=>slots.some(s=>s.hour>=selected&&s.hour<selected+h&&!s.available)).map(h=>h-1));
  useEffect(()=>{if(duration>maxDuration)setDuration(maxDuration)},[maxDuration,duration]);
  useEffect(()=>{wheelRef.current?.scrollTo({top:(duration-1)*ITEM_HEIGHT,behavior:"smooth"})},[duration]);
  function moveDuration(next:number){setDuration(Math.max(1,Math.min(maxDuration,next)))}
  function wheelScroll(){if(scrollTimer.current)clearTimeout(scrollTimer.current);scrollTimer.current=setTimeout(()=>moveDuration(Math.round((wheelRef.current?.scrollTop??0)/ITEM_HEIGHT)+1),90)}
  async function reserve(){
    const liffId=process.env.NEXT_PUBLIC_LIFF_ID;let accessToken=token;
    if(liffId){if(!window.liff){await new Promise<void>((ok,ng)=>{const s=document.createElement("script");s.src="https://static.line-scdn.net/liff/edge/2/sdk.js";s.onload=()=>ok();s.onerror=()=>ng();document.head.appendChild(s)})}await window.liff!.init({liffId});if(!window.liff!.isLoggedIn()){window.liff!.login({redirectUri:location.href});return}accessToken=window.liff!.getAccessToken();setToken(accessToken)}
    const headers:Record<string,string>={"Content-Type":"application/json"};if(accessToken)headers.Authorization=`Bearer ${accessToken}`;else headers["X-Compass-Preview"]="representative";
    const response=await fetch("/api/v1/reservations",{method:"POST",headers,body:JSON.stringify({date,startHour:selected,durationHours:duration,requestId:crypto.randomUUID()})});
    const result=await response.json();if(!response.ok){setNotice(result.error==="MEMBERSHIP_NOT_LINKED"?"会員証とLINEの連携が必要です":"予約できませんでした。空き状況を更新してください");return}
    setNotice("予約が確定しました");setSelected(null);const refresh=await fetch(`/api/v1/availability?date=${date}`).then(r=>r.json());setSlots(refresh.slots??[]);await loadReservations(accessToken)
  }
  async function cancelReservation(id:string){if(!confirm("この予約をキャンセルしますか？"))return;const response=await fetch(`/api/v1/reservations/${id}`,{method:"DELETE",headers:authHeaders()});if(!response.ok){setNotice("キャンセルできませんでした");return}setNotice("予約をキャンセルしました");await loadReservations();const refresh=await fetch(`/api/v1/availability?date=${date}`).then(r=>r.json());setSlots(refresh.slots??[])}
  return <main className="booking-shell">
    <header className="booking-head"><div><small>MUSIC STUDIO</small><h1>FEBBRAIO</h1></div><a href="/">会員証</a></header>
    <section className="booking-intro"><span>PUBLIC AVAILABILITY</span><h2>空き状況から予約する</h2><p>青い時間帯をタップすると、利用時間を選べます。</p></section>
    <label className="date-picker">利用日<input aria-label="利用日" type="date" min={today} max={limit} value={date} onChange={e=>setDate(e.target.value)}/><strong>{dateText(date)}</strong></label>
    {loading?<div className="booking-loading">確認しています…</div>:<>
      <section className="timeline-card" aria-label={`${dateText(date)}の空き状況`}>
        <div className="timeline-title"><div><small>営業時間</small><strong>8:00 — 翌2:00</strong></div><div className="timeline-legend"><span className="free">空き</span><span className="busy">予約あり</span></div></div>
        <div className="timeline-hours">{slots.map(slot=><span key={slot.hour}>{slot.hour%2===0?hourText(slot.hour).replace(":00",""):""}</span>)}<span>翌2</span></div>
        <div className="timeline-track">{slots.map(slot=>{const chosen=selected!==null&&slot.hour>=selected&&slot.hour<selected+duration;return <button aria-label={`${hourText(slot.hour)} ${slot.available?"空き":"予約あり"}`} key={slot.hour} disabled={!slot.available} className={chosen?"chosen":""} onClick={()=>{setSelected(slot.hour);setDuration(1)}}><span>{chosen&&slot.hour===selected?"開始":""}</span></button>})}</div>
        <div className="timeline-status"><strong>{selected===null?"空いている時間を選択してください":`${hourText(selected)}から${duration}時間`}</strong><span>{selected===null?"空室は青、予約済みはグレーで表示しています":`${hourText(selected+duration)}まで利用`}</span></div>
      </section>
      {selected!==null&&<section className="duration-card">
        <div className="duration-copy"><small>STEP 2</small><h3>利用時間を選ぶ</h3><p>上下にスクロール、または矢印で選択できます。</p></div>
        <div className="duration-wheel-wrap"><button className="wheel-arrow up" aria-label="利用時間を短くする" disabled={duration===1} onClick={()=>moveDuration(duration-1)}>▲</button><div className="wheel-focus" aria-hidden="true"/><div className="duration-wheel" ref={wheelRef} onScroll={wheelScroll}>{Array.from({length:maxDuration},(_,i)=>i+1).map(hours=><button type="button" key={hours} className={duration===hours?"active":""} onClick={()=>moveDuration(hours)}><strong>{hours}</strong><span>時間</span></button>)}</div><button className="wheel-arrow down" aria-label="利用時間を長くする" disabled={duration===maxDuration} onClick={()=>moveDuration(duration+1)}>▼</button></div>
        <div className="booking-summary"><small>ご利用予定</small><strong>{hourText(selected)} — {hourText(selected+duration)}</strong><span>{duration}時間</span><button onClick={reserve}>{process.env.NEXT_PUBLIC_LIFF_ID?"LINE会員として予約する":"代表会員でテスト予約する"}</button></div>
      </section>}
    </>}
    <section className="reservation-history"><div><small>MY RESERVATIONS</small><h2>予約履歴</h2></div>{reservations.length===0?<p>予約はまだありません。</p>:reservations.map(item=><article key={item.id}><span>{item.status==="CONFIRMED"?"予約確定":item.status==="CANCELLED"?"キャンセル":"利用完了"}</span><div><strong>{new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(item.startsAt))}</strong><small>〜 {new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(item.endsAt))}</small></div>{item.status==="CONFIRMED"&&item.startsAt>Date.now()&&<button onClick={()=>cancelReservation(item.id)}>キャンセル</button>}</article>)}</section>
    {notice&&<button className="booking-notice" onClick={()=>setNotice("")}>{notice}</button>}
  </main>
}
