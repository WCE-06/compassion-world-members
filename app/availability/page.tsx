"use client";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

declare global { interface Window { liff?: {init(c:{liffId:string}):Promise<void>;isLoggedIn():boolean;login(c?:{redirectUri?:string}):void;getAccessToken():string|null} } }
function loadLiff(){return new Promise<void>((resolve,reject)=>{if(window.liff)return resolve();const script=document.createElement("script");script.src="https://static.line-scdn.net/liff/edge/2/sdk.js";script.onload=()=>resolve();script.onerror=()=>reject(new Error("LINE認証を読み込めませんでした"));document.head.appendChild(script)})}

export default function AvailabilityBridge(){
 const [message,setMessage]=useState("FEBBRAIO予約画面を開いています…"),[retry,setRetry]=useState(false);
 async function openReservation(){setRetry(false);setMessage("FEBBRAIO予約画面を開いています…");try{const config=await fetch("/api/v1/client-config").then(r=>r.json()),liffId=String(config.liffId??"");if(!liffId)throw new Error("LINE認証を準備できませんでした");await loadLiff();await window.liff!.init({liffId});if(!window.liff!.isLoggedIn()){window.liff!.login({redirectUri:location.href});return}const accessToken=window.liff!.getAccessToken();if(!accessToken)throw new Error("LINE認証を確認できませんでした");const response=await fetch("/api/v1/febbraio/launch",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`}}),result=await response.json();if(!response.ok)throw new Error(result.message??"予約画面へ接続できませんでした");const form=document.createElement("form");form.method="POST";form.action=result.exchangeUrl;const input=document.createElement("input");input.type="hidden";input.name="token";input.value=result.token;form.appendChild(input);document.body.appendChild(form);form.submit()}catch(error){setMessage(error instanceof Error?error.message:"予約画面へ接続できませんでした");setRetry(true)}}
 useEffect(()=>{openReservation()},[]);
 return <main className="booking-shell"><header className="booking-head"><div><small>MUSIC STUDIO</small><h1>FEBBRAIO</h1></div><a href="/">会員証</a></header><section className="booking-loading" role="status"><CalendarDays size={28}/><strong>{message}</strong><p>開始時刻は15分単位で選択できます。</p>{retry&&<button className="flow-button" onClick={openReservation}>予約画面を開く</button>}</section></main>
}
