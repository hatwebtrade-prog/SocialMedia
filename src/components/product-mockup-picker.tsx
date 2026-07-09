"use client";

export interface ProductOption { id: string; nome: string; imagePath: string | null }
export interface ProductMockupValue { productId: string; useMockup: boolean }

// Invariant: no product selected => useMockup must be false.
export function withProduct(value: ProductMockupValue, productId: string): ProductMockupValue {
  return { productId, useMockup: productId ? value.useMockup : false };
}
export function withMockup(value: ProductMockupValue, useMockup: boolean): ProductMockupValue {
  return { productId: value.productId, useMockup: value.productId ? useMockup : false };
}

export function ProductMockupPicker({ products, value, onChange }: {
  products: ProductOption[];
  value: ProductMockupValue;
  onChange: (next: ProductMockupValue) => void;
}) {
  const withImage = products.filter((p) => p.imagePath);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <select
        value={value.productId}
        onChange={(e) => onChange(withProduct(value, e.target.value))}
        className="rounded border p-1"
      >
        <option value="">Nessun prodotto</option>
        {withImage.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={value.useMockup}
          onChange={(e) => onChange(withMockup(value, e.target.checked))}
          disabled={!value.productId}
        />
        Includi il mockup nel contesto (image-edit)
      </label>
      {value.productId && value.useMockup && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/products/${value.productId}/image`} alt="" className="h-14 w-14 rounded border object-contain" />
      )}
    </div>
  );
}
