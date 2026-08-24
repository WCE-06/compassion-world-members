"use client";

import Link from "next/link";

export type MemberTableRow={memberCode:string;displayName:string;lineDisplayName:string|null;phone:string;pointsBalance:number;status:"ACTIVE"|"INACTIVE";createdAt:number;syncStatus:"PENDING"|"SYNCING"|"SYNCED"|"FAILED"|null;currentRank?:string|null;qualifyingSpend?:number|null;residentPlanActive?:number|null};

export function MemberTable({rows,rankLabel,selected,onSelection,onStudio,onStatus,busy}:{rows:MemberTableRow[];rankLabel:Record<string,string>;selected:Set<string>;onSelection:(next:Set<string>)=>void;onStudio:(code:string)=>void;onStatus:(row:MemberTableRow)=>void;busy:string}){
  const allSelected=rows.length>0&&rows.every(row=>selected.has(row.memberCode));
  const toggleAll=()=>onSelection(allSelected?new Set():new Set(rows.map(row=>row.memberCode)));
  const toggle=(code:string)=>{const next=new Set(selected);next.has(code)?next.delete(code):next.add(code);onSelection(next)};
  return <div className="member-table-wrap"><table className="member-table">
    <thead><tr><th><input aria-label="表示中の会員をすべて選択" type="checkbox" checked={allSelected} onChange={toggleAll}/></th><th>会員</th><th>会員番号</th><th>ポイント</th><th>ランク・対象額</th><th>住民</th><th>スマレジ</th><th>状態</th><th>操作</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.memberCode} className={selected.has(row.memberCode)?"selected":""}>
      <td><input aria-label={`${row.displayName}を選択`} type="checkbox" checked={selected.has(row.memberCode)} onChange={()=>toggle(row.memberCode)}/></td>
      <td><strong>{row.displayName}</strong><small>{row.lineDisplayName?`LINE：${row.lineDisplayName}`:row.phone||"連絡先未登録"}</small></td>
      <td><code>{row.memberCode}</code><small>{new Date(row.createdAt).toLocaleDateString("ja-JP")}</small></td>
      <td><b>{row.pointsBalance.toLocaleString("ja-JP")}pt</b></td>
      <td><b>{rankLabel[row.currentRank??""]??"未集計"}</b><small>¥{(row.qualifyingSpend??0).toLocaleString("ja-JP")}</small></td>
      <td>{row.residentPlanActive?<span className="table-badge resident">住民</span>:<span className="table-badge">一般</span>}</td>
      <td><span className={`table-badge sync-${(row.syncStatus??"existing").toLowerCase()}`}>{row.syncStatus??"既存会員"}</span></td>
      <td><span className={`table-badge state-${row.status.toLowerCase()}`}>{row.status==="ACTIVE"?"利用中":"停止中"}</span></td>
      <td><div className="table-actions"><Link href={`/member-admin/members/${row.memberCode}`}>詳細・編集</Link><button onClick={()=>onStudio(row.memberCode)}>予約</button><button disabled={busy===row.memberCode} onClick={()=>onStatus(row)}>{row.status==="ACTIVE"?"停止":"再開"}</button></div></td>
    </tr>)}</tbody>
  </table></div>;
}
