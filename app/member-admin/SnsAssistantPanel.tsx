"use client";
import {FormEvent,useEffect,useState} from "react";

type Message={role:"user"|"assistant";content:string};
const welcome:Message={role:"assistant",content:"投稿したい内容を教えてください。Instagram・X・Threads・LINEに合わせて、会話しながら整えます。日時や画像、対象のお客様が決まっていれば一緒に入力してください。"};

export function SnsAssistantPanel(){
 const [messages,setMessages]=useState<Message[]>([welcome]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[configured,setConfigured]=useState<boolean|null>(null),[notice,setNotice]=useState("");
 useEffect(()=>{void fetch("/api/v1/admin/sns-assistant",{cache:"no-store"}).then(async response=>{if(response.status===401){location.replace("/member-admin/login");return}setConfigured(response.ok&&Boolean((await response.json()).configured))}).catch(()=>setConfigured(false))},[]);
 const send=async(event:FormEvent)=>{event.preventDefault();const text=input.trim();if(!text||busy)return;const next=[...messages,{role:"user" as const,content:text}];setMessages(next);setInput("");setBusy(true);setNotice("");try{const response=await fetch("/api/v1/admin/sns-assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next.slice(1)}),signal:AbortSignal.timeout(30000)}),result=await response.json();if(!response.ok)throw new Error(result.message??"投稿案を生成できませんでした");setMessages(value=>[...value,{role:"assistant",content:String(result.message)}])}catch(error){setNotice(error instanceof Error?error.message:"投稿案を生成できませんでした")}finally{setBusy(false)}};
 const save=async(message:string)=>{setNotice("投稿台帳へ保存しています…");const response=await fetch("/api/v1/admin/engagement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({resource:"campaigns",requestId:crypto.randomUUID(),name:`SNS投稿案 ${new Date().toLocaleString("ja-JP")}`,title:"SNS投稿案",message,channel:"MULTI"})});setNotice(response.ok?"投稿案を配信台帳へ下書き保存しました":"下書きを保存できませんでした")};
 return <section className="sns-assistant-panel"><header><div><small>SNS CREATIVE ASSISTANT</small><h2>投稿相談AI</h2><p>媒体ごとの投稿案を会話しながら作り、承認前の下書きとして保存します。</p></div><span className={configured?"ready":"waiting"}>{configured===null?"接続確認中":configured?"AI接続済み":"APIキー設定待ち"}</span></header>
  {!configured&&configured!==null&&<p className="sns-assistant-warning">OpenAI APIキーの設定後に会話生成が有効になります。投稿台帳や既存SNS管理はそのまま利用できます。</p>}
  <div className="sns-chat-log">{messages.map((message,index)=><article className={message.role} key={index}><small>{message.role==="assistant"?"SNSアシスタント":"スタッフ"}</small><p>{message.content}</p>{message.role==="assistant"&&index>0&&<button onClick={()=>void save(message.content)}>この案を投稿台帳へ保存</button>}</article>)}{busy&&<article className="assistant thinking"><small>SNSアシスタント</small><p>投稿案を考えています…</p></article>}</div>
  {notice&&<p className="member-admin-message" role="status">{notice}</p>}
  <form className="sns-chat-form" onSubmit={send}><textarea rows={4} maxLength={4000} value={input} onChange={event=>setInput(event.target.value)} placeholder="例：今週土曜の無料ライブを、近所の人がふらっと来たくなる雰囲気で。LINEは短め、Instagramは詳しく。"/><button disabled={busy||!configured||!input.trim()}>{busy?"考案中…":"投稿案を相談する"}</button></form>
  <div className="sns-quick-prompts"><button onClick={()=>setInput("Instagram・X・Threads・LINEの4媒体向けに、それぞれ文章を作り分けてください。")}>4媒体分を作る</button><button onClick={()=>setInput("もっと近所の人が気軽にふらっと立ち寄りたくなる文章に直してください。")}>親しみやすくする</button><button onClick={()=>setInput("重要情報が冒頭だけで伝わる短いLINE告知にしてください。")}>LINE向けに短く</button></div>
 </section>
}
