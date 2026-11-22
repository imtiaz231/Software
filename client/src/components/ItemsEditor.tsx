import { fmt } from '../ui';

export interface Item { name: string; qty: number | string; price: number | string }
export const emptyItem = (): Item => ({ name: '', qty: 1, price: '' });
export const itemsTotal = (it: Item[]) => it.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
export const cleanItems = (it: Item[]) => it.map((i) => ({ name: i.name.trim(), qty: Number(i.qty), price: Number(i.price) }));

export default function ItemsEditor({ items, onChange }: { items: Item[]; onChange: (i: Item[]) => void }) {
  const set = (i: number, k: keyof Item, v: string) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="items">
      <div className="items-head"><span>Item</span><span>Qty</span><span>Price</span><span>Amount</span><span /></div>
      {items.map((it, i) => (
        <div className="items-row" key={i}>
          <input aria-label="Item name" placeholder="Item name" value={it.name} onChange={(e) => set(i, 'name', e.target.value)} />
          <input aria-label="Quantity" type="number" min="0" step="any" value={it.qty} onChange={(e) => set(i, 'qty', e.target.value)} />
          <input aria-label="Price" type="number" min="0" step="any" placeholder="0" value={it.price} onChange={(e) => set(i, 'price', e.target.value)} />
          <b className="num">{fmt((Number(it.qty) || 0) * (Number(it.price) || 0))}</b>
          <button type="button" className="btn ghost sm" aria-label="Remove item" disabled={items.length === 1} onClick={() => onChange(items.filter((_, j) => j !== i))}>x</button>
        </div>
      ))}
      <div className="items-foot">
        <button type="button" className="btn ghost sm" onClick={() => onChange([...items, emptyItem()])}>+ Add item</button>
        <div>Bill total: <b className="big">{fmt(itemsTotal(items))}</b></div>
      </div>
    </div>
  );
}
