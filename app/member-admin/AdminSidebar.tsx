"use client";

import { BarChart3, CalendarDays, ClipboardCheck, Gift, LayoutDashboard, Megaphone, PackageSearch, Radio, Settings, Users, WalletCards } from "lucide-react";

export type AdminSection = "dashboard" | "members" | "studio" | "tasks" | "sns" | "benefits" | "communication" | "residents" | "finance" | "inventory" | "analytics" | "settings";

const items: Array<{key: AdminSection; label: string; icon: typeof Users; ready: boolean}> = [
  {key:"dashboard",label:"ダッシュボード",icon:LayoutDashboard,ready:true},
  {key:"members",label:"会員管理",icon:Users,ready:true},
  {key:"studio",label:"スタジオ",icon:CalendarDays,ready:true},
  {key:"tasks",label:"作業タスク",icon:ClipboardCheck,ready:false},
  {key:"sns",label:"SNSコントロール",icon:Radio,ready:false},
  {key:"benefits",label:"特典・ポイント",icon:Gift,ready:false},
  {key:"communication",label:"配信・アンケート",icon:Megaphone,ready:false},
  {key:"residents",label:"住民登録",icon:Users,ready:false},
  {key:"finance",label:"精算・売上",icon:WalletCards,ready:false},
  {key:"inventory",label:"在庫確認",icon:PackageSearch,ready:false},
  {key:"analytics",label:"分析",icon:BarChart3,ready:false},
  {key:"settings",label:"設定・同期",icon:Settings,ready:true},
];

export function AdminSidebar({active,onSelect}:{active:AdminSection;onSelect:(section:AdminSection)=>void}){
  return <aside className="admin-sidebar">
    <div className="admin-sidebar-brand"><small>COMPASSION WORLD</small><strong>STAFF CONSOLE</strong></div>
    <nav aria-label="管理メニュー">
      {items.map(({key,label,icon:Icon,ready})=><button key={key} className={active===key?"active":""} onClick={()=>onSelect(key)}>
        <Icon size={18}/><span>{label}</span>{!ready&&<small>準備中</small>}
      </button>)}
    </nav>
  </aside>;
}
