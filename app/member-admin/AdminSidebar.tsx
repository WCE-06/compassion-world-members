"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Database,
  Gift,
  LayoutDashboard,
  Megaphone,
  PackageSearch,
  Radio,
  Settings,
  Store,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ButtonFeedback } from "./ButtonFeedback";

export type AdminSection =
  | "dashboard"
  | "members"
  | "studio"
  | "tasks"
  | "sns"
  | "benefits"
  | "communication"
  | "residents"
  | "finance"
  | "products"
  | "inventory"
  | "analytics"
  | "staff"
  | "settings";

const items: Array<{
  key: AdminSection;
  label: string;
  icon: typeof Users;
  ready: boolean;
}> = [
  {
    key: "dashboard",
    label: "ダッシュボード",
    icon: LayoutDashboard,
    ready: true,
  },
  { key: "members", label: "会員管理", icon: Users, ready: true },
  { key: "studio", label: "スタジオ", icon: CalendarDays, ready: true },
  { key: "tasks", label: "スタッフToDo", icon: ClipboardCheck, ready: true },
  { key: "sns", label: "SNSコントロール", icon: Radio, ready: true },
  { key: "benefits", label: "特典・ポイント", icon: Gift, ready: true },
  {
    key: "communication",
    label: "配信・アンケート",
    icon: Megaphone,
    ready: true,
  },
  { key: "residents", label: "住民登録", icon: Users, ready: true },
  { key: "finance", label: "取引・精算・売上", icon: WalletCards, ready: true },
  {
    key: "products",
    label: "商品マスタ・期間売価",
    icon: Database,
    ready: true,
  },
  {
    key: "inventory",
    label: "商品・在庫確認",
    icon: PackageSearch,
    ready: true,
  },
  { key: "analytics", label: "分析", icon: BarChart3, ready: true },
  { key: "staff", label: "スタッフ・権限", icon: UserCog, ready: true },
  { key: "settings", label: "設定・同期", icon: Settings, ready: true },
];

export function AdminSidebar({
  active,
  onSelect,
}: {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
}) {
  return (
    <>
      <ButtonFeedback />
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <small>COMPASSION WORLD</small>
          <strong>STAFF CONSOLE</strong>
        </div>
        <nav aria-label="管理メニュー">
          {items.map(({ key, label, icon: Icon, ready }) => (
            <button
              key={key}
              className={active === key ? "active" : ""}
              onClick={() => onSelect(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {!ready && <small>準備中</small>}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function AdminMobileNav({
  active,
  onSelect,
}: {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
}) {
  const groups = useMemo(
    () => [
      {
        key: "customers",
        label: "顧客",
        icon: Users,
        items: ["members", "residents", "benefits"] as AdminSection[],
      },
      {
        key: "sales",
        label: "営業",
        icon: WalletCards,
        items: ["finance", "studio", "tasks"] as AdminSection[],
      },
      {
        key: "products",
        label: "商品",
        icon: Store,
        items: ["products", "inventory", "analytics"] as AdminSection[],
      },
      {
        key: "manage",
        label: "運営",
        icon: Settings,
        items: ["communication", "sns", "staff", "settings"] as AdminSection[],
      },
    ],
    [],
  );
  const activeGroup =
    groups.find((group) => group.items.includes(active))?.key ?? "";
  const [open, setOpen] = useState("");
  const choose = (section: AdminSection) => {
    onSelect(section);
    setOpen("");
  };
  const current = groups.find((group) => group.key === open);
  return (
    <>
      {current && (
        <div
          className="admin-mobile-menu-sheet"
          role="dialog"
          aria-label={`${current.label}メニュー`}
        >
          <header>
            <strong>{current.label}メニュー</strong>
            <button aria-label="メニューを閉じる" onClick={() => setOpen("")}>
              <X size={20} />
            </button>
          </header>
          <div>
            {current.items.map((key) => {
              const item = items.find((value) => value.key === key)!;
              const Icon = item.icon;
              return (
                <button
                  key={key}
                  className={active === key ? "active" : ""}
                  onClick={() => choose(key)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {open && (
        <button
          className="admin-mobile-menu-backdrop"
          aria-label="メニューを閉じる"
          onClick={() => setOpen("")}
        />
      )}
      <nav
        className="admin-mobile-tabs"
        aria-label="スマートフォン用管理メニュー"
      >
        <button
          className={active === "dashboard" ? "active" : ""}
          onClick={() => choose("dashboard")}
        >
          <LayoutDashboard size={18} />
          <span>ホーム</span>
        </button>
        {groups.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={activeGroup === key || open === key ? "active" : ""}
            aria-expanded={open === key}
            onClick={() => setOpen((value) => (value === key ? "" : key))}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
