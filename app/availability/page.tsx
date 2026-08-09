"use client";
import { useEffect, useMemo, useState } from "react";

type Slot = { hour: number; startsAt: number; available: boolean };
declare global { interface Window { liff?: { init(c:{liffId:string}):Promise<void>; isLoggedIn():boolean; login(c?:{redirectUri?:string}):void; getAccessToken():string|null } } }
function dateText(date:string){return new Intl.DateTimeFormat("ja-JP",{month:"long",day:"numeric",weekday:"short"}).format(new Date(`${date}T00:00:00+09:00`))}
function hourText(hour:number){return hour < 24 ? `${hour}:00` : `翌${hour-24}:00`}

export default function AvailabilityPage(){
  const today=useMemo(()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(new Date()),[]);
  const limit=useMemo(()=>{const d=new Date(`${today}T00:00:00+09:00`);d.setMonth(d.getMonth()+1);return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(d)},[today]);
  const [date,setDate]=useState(today),[slots,setSlots]=useState<Slot[]>([]),[loading,setLoading]=useState(true),[selected,setSelected]=useState<number|null>(null),[duration,setDuration]=useState(1),[notice,setNotice]=useState("");
  useEffect(()=>{setLoading(true);setSelected(null);fetch(`/api/v1/availability?date=${date}`).then(r=>r.json()).then(x=>setSlots(x.slots??[])).catch(()=>setNotice("空き状況を取得できませんでした")).finally(()=>setLoading(false))},[date]);
  const maxDuration=selected==null?1:Math.min(10,26-selected,...Array.from({length:10},(_,i)=>i+1).filter(h=>slots.some(s=>s.hour>=selected&&s.hour<selected+h&&!s.available)).map(h=>h-1));
  useEffect(()=>{if(duration>maxDuration)setDuration(maxDuration)},[maxDuration,duration]);
  async function reserve(){
    const liffId=process.env.NEXT_PUBLIC_LIFF_ID;if(!liffId){setNotice("LINEメニューから開くと予約できます");return}
    if(!window.liff){await new Promise<void>((ok,ng)=>{const s=document.createElement("script");s.src="https://static.line-scdn.net/liff/edge/2/sdk.js";s.onload=()=>ok();s.onerror=()=>ng();document.head.appendChild(s)})}
    await window.liff!.init({liffId});if(!window.liff!.isLoggedIn()){window.liff!.login({redirectUri:location.href});return}
    const response=await fetch("/api/v1/reservations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${window.liff!.getAccessToken()}`},body:JSON.stringify({date,startHour:selected,durationHours:duration})});
    const result=await response.json();if(!response.ok){setNotice(result.error==="MEMBERSHIP_NOT_LINKED"?"会員証とLINEの連携が必要です":"予約できませんでした。空き状況を更新してください");return}
    setNotice("予約が確定しました");setSelected(null);const refresh=await fetch(`/api/v1/availability?date=${date}`).then(r=>r.json());setSlots(refresh.slots??[])
  }
  return <main className="booking-shell"><header className="booking-head"><div><small>MUSIC STUDIO</small><h1>FEBBRAIO</h1></div><a href="/">会員証</a></header><section className="booking-intro"><span>PUBLIC AVAILABILITY</span><h2>空き状況</h2><p>空き状況はどなたでも確認できます。予約確定には会員認証が必要です。</p></section><label className="date-picker">利用日<input type="date" min={today} max={limit} value={date} onChange={e=>setDate(e.target.value)}/><strong>{dateText(date)}</strong></label>{loading?<div className="booking-loading">確認しています…</div>:<section className="slot-grid">{slots.map(slot=><button key={slot.hour} disabled={!slot.available} className={selected===slot.hour?"selected":""} onClick={()=>{setSelected(slot.hour);setDuration(1)}}><strong>{hourText(slot.hour)}</strong><span>{slot.available?"空き":"予約あり"}</span></button>)}</section>}{selected!==null&&<section className="reserve-panel"><div><small>開始時間</small><strong>{hourText(selected)}</strong></div><label>利用時間<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{Array.from({length:maxDuration},(_,i)=><option key={i+1} value={i+1}>{i+1}時間</option>)}</select></label><button onClick={reserve}>LINE会員として予約する</button></section>}{notice&&<div className="booking-notice" onClick={()=>setNotice("")}>{notice}</div>}</main>
}
