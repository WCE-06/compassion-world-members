import {env} from "cloudflare:workers";
import {NextRequest,NextResponse} from "next/server";
import {requireAdminSession} from "@/lib/admin-session";

type ChatMessage={role:"user"|"assistant";content:string};

function admin(request:NextRequest){
 const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
 const allowed=((env as unknown as Record<string,string|undefined>).ADMIN_EMAILS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
 return email&&allowed.includes(email)?email:null;
}

const instructions=`あなたはCOMPASSION WORLDのスタッフ専用SNS編集アシスタントです。
親しみやすく、誇張せず、近隣の人が気軽に立ち寄りたくなる日本語を提案してください。
Instagram、X、Threads、LINEは媒体ごとに文章を作り分けます。
日時、会場、料金、予約要否、出演者など確定情報を勝手に補完しません。不足情報は短く質問してください。
投稿案を求められた場合は、媒体名を見出しにして、そのままコピーできる完成稿を提示してください。
LINEは冒頭だけでも要点が伝わる構成にし、配信通数を意識します。
最終公開や送信を実行したと表現せず、必ずスタッフの確認を促してください。`;

export async function GET(request:NextRequest){
 if(!(admin(request)??await requireAdminSession(request)))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const runtime=env as unknown as Record<string,string|undefined>;
 return NextResponse.json({configured:Boolean(runtime.OPENAI_API_KEY),model:runtime.OPENAI_SNS_MODEL??"gpt-5.4-mini"},{headers:{"Cache-Control":"private, max-age=30"}});
}

export async function POST(request:NextRequest){
 if(!(admin(request)??await requireAdminSession(request)))return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 const runtime=env as unknown as Record<string,string|undefined>,apiKey=runtime.OPENAI_API_KEY;
 if(!apiKey)return NextResponse.json({error:"OPENAI_NOT_CONFIGURED",message:"OpenAI APIキーを設定するとSNS相談AIを利用できます。"},{status:503});
 const body=await request.json().catch(()=>null) as {messages?:ChatMessage[]}|null;
 const messages=(body?.messages??[]).filter(item=>(item.role==="user"||item.role==="assistant")&&typeof item.content==="string").slice(-12).map(item=>({role:item.role,content:item.content.trim().slice(0,4000)})).filter(item=>item.content);
 if(!messages.length)return NextResponse.json({error:"MESSAGE_REQUIRED"},{status:400});
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:runtime.OPENAI_SNS_MODEL??"gpt-5.4-mini",instructions,input:messages,max_output_tokens:1800,store:false})});
  const result=await response.json() as {output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>;error?:{message?:string}};
  if(!response.ok){console.error("sns assistant failed",response.status,result.error?.message);return NextResponse.json({error:"OPENAI_REQUEST_FAILED",message:"投稿案を生成できませんでした。少し時間をおいて再試行してください。"},{status:502})}
  const text=result.output_text??result.output?.flatMap(item=>item.content??[]).filter(item=>item.type==="output_text").map(item=>item.text??"").join("\n")??"";
  if(!text)return NextResponse.json({error:"EMPTY_RESPONSE"},{status:502});
  return NextResponse.json({message:text});
 }catch(error){console.error("sns assistant connection failed",error);return NextResponse.json({error:"OPENAI_CONNECTION_FAILED",message:"SNS相談AIへ接続できませんでした。"},{status:502})}
}
