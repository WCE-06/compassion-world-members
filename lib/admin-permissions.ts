export const adminPermissions=["DASHBOARD_READ","MEMBER_READ","MEMBER_WRITE","STUDIO_WRITE","FINANCE_READ","CATALOG_READ","CATALOG_WRITE","COMMUNICATION_WRITE","STAFF_ADMIN","SETTINGS_ADMIN"] as const;
export type AdminPermission=typeof adminPermissions[number];

export const rolePermissions:Record<string,AdminPermission[]>={
 OWNER:[...adminPermissions],
 ADMIN:[...adminPermissions],
 STORE:["DASHBOARD_READ","MEMBER_READ","MEMBER_WRITE","STUDIO_WRITE","FINANCE_READ","CATALOG_READ"],
 KITCHEN:["DASHBOARD_READ","CATALOG_READ","CATALOG_WRITE"],
 VIEWER:["DASHBOARD_READ","MEMBER_READ","FINANCE_READ","CATALOG_READ"],
};

export const pagePermission={dashboard:"DASHBOARD_READ",members:"MEMBER_READ",studio:"STUDIO_WRITE",tasks:"DASHBOARD_READ",sns:"COMMUNICATION_WRITE",benefits:"COMMUNICATION_WRITE",communication:"COMMUNICATION_WRITE",residents:"MEMBER_READ",finance:"FINANCE_READ",products:"CATALOG_READ",inventory:"CATALOG_READ",analytics:"FINANCE_READ",staff:"STAFF_ADMIN",settings:"SETTINGS_ADMIN"} as const;

export function normalizePermissions(value:unknown,role:string):AdminPermission[]{
 if(!Array.isArray(value))return rolePermissions[role]??[];
 const allowed=new Set<AdminPermission>(adminPermissions);
 return [...new Set(value.filter((item):item is AdminPermission=>typeof item==="string"&&allowed.has(item as AdminPermission)))];
}
