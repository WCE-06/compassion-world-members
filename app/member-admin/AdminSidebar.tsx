"use client";

import { BarChart3, CalendarDays, ClipboardCheck, Database, Gift, LayoutDashboard, Megaphone, PackageSearch, Radio, Settings, UserCog, Users, WalletCards } from "lucide-react";

export type AdminSection = "dashboard" | "members" | "studio" | "tasks" | "sns" | "benefits" | "communication" | "residents" | "finance" | "products" | "inventory" | "analytics" | "staff" | "settings";

const items: Array<{key: AdminSection; label: string; icon: typeof Users; ready: boolean}> = [
  {key:"dashboard",label:"ダッシュボード",icon:LayoutDashboard,ready:true},
  {key:"members",label:"会員管理",icon:Users,ready:true},
  {key:"studio",label:"スタジオ",icon:CalendarDays,ready:true},
  {key:"tasks",label:"作業タスク",icon:ClipboardCheck,ready:true},
  {key:"sns",label:"SNSコントロール",icon:Radio,ready:true},
  {key:"benefits",label:"特典・ポイント",icon:Gift,ready:true},
  {key:"communication",label:"配信・アンケート",icon:Megaphone,ready:true},
  {key:"residents",label:"住民登録",icon:Users,ready:true},
  {key:"finance",label:"取引・精算・売上",icon:WalletCards,ready:true},
  {key:"products",label:"商品マスタ",icon:Database,ready:true},
  {key:"inventory",label:"商品・在庫確認",icon:PackageSearch,ready:true},
  {key:"analytics",label:"分析",icon:BarChart3,ready:true},
  {key:"staff",label:"スタッフ・権限",icon:UserCog,ready:true},
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

export function AdminMobileNav({active,onSelect}:{active:AdminSection;onSelect:(section:AdminSection)=>void}){
  return <nav className="admin-mobile-tabs" aria-label="スマートフォン用管理メニュー">
    {items.map(({key,label,icon:Icon})=><button key={key} className={active===key?"active":""} onClick={()=>onSelect(key)}>
      <Icon size={17}/><span>{label}</span>
    </button>)}
  </nav>;
}
