export type StoredNoticeRow={id:string;category:"PAYMENT"|"POINT"|"RESERVATION"|"ORDER"|"NEWS";title:string;body:string;sender:string;readAt:number|null;createdAt:number};

export function storedNotice(item:StoredNoticeRow){return{id:item.id,category:item.category,title:item.title,body:item.body,sender:item.sender,createdAt:new Date(item.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}),unread:!item.readAt}}

export function welcomeNotice(member:{id:string;createdAt:number;cardStartedAt:number|null}){return{id:`welcome:${member.id}`,category:"NEWS" as const,title:"新しいポイントカードのご利用ありがとうございます",body:"COMPASSION WORLDの新しいポイントカードへようこそ。これまでの会員情報を引き継いだ方も、初めて登録した方も、予約・注文・会員特典をこの画面からご利用いただけます。",createdAt:new Date(member.cardStartedAt??member.createdAt).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}),unread:false}}

