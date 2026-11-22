export interface Shop {
  id: number; name: string; address: string; phone: string; logo: string | null;
  status: 'active' | 'blocked'; expires_at: string | null; access: boolean; daysLeft: number; must_change: boolean; created_at: string;
}
export type Kind = 'hardware' | 'electronic';
export interface BillItem { name: string; qty: number; price: number }
export interface Dealer { id: number; type: Kind; name: string; company: string; phone: string; bills: number; total: number }
export interface PurchaseBill {
  has_image: boolean;
  id: number; bill_no: string; bill_date: string; items: BillItem[]; total: number;
  dealer_name: string; dealer_company: string; dealer_phone: string; dealer_type: Kind;
}
export interface SaleBill { id: number; bill_no: string; bill_date: string; category: Kind; items: BillItem[]; total: number; profit: number }
export interface Payment {
  id: number; method: string; months: number; amount: number; txn_ref: string; screenshot: string | null;
  status: 'pending' | 'approved' | 'rejected'; note: string | null; created_at: string; reviewed_at: string | null;
  shop_name?: string; shop_phone?: string;
}
export interface PasswordRequest { id: number; shop_id: number; shop_name: string; shop_phone: string; note: string | null; status: 'pending' | 'done' | 'dismissed'; created_at: string; resolved_at: string | null }
export interface Customer { id: number; name: string; phone: string; address: string | null; balance: number; last_activity: string | null }
export interface LedgerEntry {
  id: number; type: 'credit' | 'payment'; ref_no: string; entry_date: string; items: BillItem[] | null; note: string | null; amount: number;
  sale_bill_no: string | null; voided: number; void_reason: string | null; running_balance: number;
}
export interface Activity { id: number; action: string; details: string; created_at: string; actor?: string; shop_name?: string | null }
