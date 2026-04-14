import { createPortal } from 'react-dom'

function generatePrintHTML(recipe, restaurant, menuName, ingList, prepSteps) {
  const printDate = new Date().toLocaleDateString('es-CO')
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${recipe.name || 'Receta'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'DM Sans',sans-serif; background:#fff; color:#111; }
    @media print { body { margin:0; } @page { margin:0; } }
  </style>
</head>
<body>

<div style="display:grid;grid-template-columns:1fr 1fr;min-height:100vh">

  <!-- COLUMNA IZQUIERDA -->
  <div style="display:flex;flex-direction:column">

    <div style="background:#111111;padding:20px 24px;display:flex;gap:16px;align-items:flex-start">
      <div style="flex-shrink:0">
        ${restaurant?.logoURL
          ? `<img src="${restaurant.logoURL}" style="width:70px;height:50px;object-fit:contain;border-radius:4px">`
          : `<div style="width:70px;height:50px;border:1px dashed #444;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#555;font-size:9px;text-align:center;line-height:1.3">Sin<br>Logo</div>`
        }
      </div>
      <div style="flex:1">
        <div style="font-family:'Playfair Display',serif;font-size:18px;color:#c9a84c;font-weight:700;line-height:1.2;margin-bottom:6px">
          ${restaurant?.name || 'RecetarioPro'}
        </div>
        <div style="font-family:'Playfair Display',serif;font-size:14px;color:#ffffff;font-weight:400;line-height:1.3">
          ${recipe.name || ''}
        </div>
      </div>
    </div>

    <div style="padding:20px 24px;display:flex;justify-content:center;align-items:center;flex:1;background:#1a1a1a">
      ${recipe.photoURL
        ? `<img src="${recipe.photoURL}" style="width:180px;height:180px;border-radius:50%;border:3px solid #c9a84c;object-fit:cover;display:block">`
        : `<div style="width:180px;height:180px;border-radius:50%;border:3px solid #c9a84c;background:#111;display:flex;align-items:center;justify-content:center;font-size:64px">🍽</div>`
      }
    </div>

    <div style="background:#1a1a1a;padding:14px 24px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.08em;width:70px">Menú</span>
          <span style="font-size:11px;color:#fff;font-weight:500">${menuName || '—'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.08em;width:70px">Código</span>
          <span style="font-size:11px;color:#fff;font-weight:500">${recipe.code || '—'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.08em;width:70px">Referencia</span>
          <span style="font-size:11px;color:#fff;font-weight:500">${recipe.reference || '—'}</span>
        </div>
      </div>
    </div>

  </div>

  <!-- COLUMNA DERECHA -->
  <div style="background:#f5f0e8;display:flex;flex-direction:column">

    <div style="background:#111111;padding:20px 24px;min-height:90px"></div>

    <div style="flex:1;padding:20px 24px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#999;font-weight:700;margin-bottom:12px">
        Ingredientes
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:right;padding:4px 8px 4px 0;font-size:8px;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;width:60px">Cant.</th>
            <th style="text-align:left;padding:4px 8px;font-size:8px;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;width:50px">Un.</th>
            <th style="text-align:left;padding:4px 0;font-size:8px;color:#aaa;text-transform:uppercase;letter-spacing:0.06em">Ingrediente</th>
          </tr>
        </thead>
        <tbody>
          ${ingList.map(ing => `
            <tr style="border-bottom:1px solid rgba(0,0,0,0.07)">
              <td style="text-align:right;padding:6px 8px 6px 0;font-size:12px;color:#333;font-weight:600">${ing.quantity || ''}</td>
              <td style="padding:6px 8px;font-size:10px;color:#888;text-transform:uppercase">${ing.unit || ''}</td>
              <td style="padding:6px 0;font-size:11px;color:#111;font-weight:500">${ing.description || ing.ingredientName || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${prepSteps.length > 0 ? `
      <div style="margin-top:20px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#999;font-weight:700;margin-bottom:10px">
          Preparación
        </div>
        <div style="background:#fff;border-radius:6px;padding:12px;font-size:10px;line-height:1.9;color:#333">
          ${prepSteps.map((line, i) => `<p style="margin:0 0 4px 0">${i + 1}. ${line}</p>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div style="background:#111111;padding:10px 24px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:8px;color:#666">RecetarioPro</span>
      <span style="font-size:8px;color:#666">v${recipe.version || 1} · ${printDate}</span>
    </div>

  </div>

</div>

<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:'Playfair Display',serif;font-size:80px;color:rgba(0,0,0,0.03);white-space:nowrap;pointer-events:none;font-weight:700">
  ${restaurant?.name || 'RecetarioPro'}
</div>

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); window.close(); }, 1200)
  }
</script>

</body>
</html>`
}

export function RecipePrintView({ recipe, restaurant, categories, onClose }) {
  const cat = categories?.find((c) => c.id === recipe?.categoryId)
  const menuName = recipe?.isSubRecipe ? 'Sub-receta' : (cat?.name || '—')
  const ingList = (recipe?.ingredients || []).filter(
    (i) => i.description || i.ingredientName || i.ingredientId
  )
  const prepSteps = (recipe?.preparation || '')
    .split('\n')
    .filter((s) => s.trim())
    .map((s) => s.replace(/^\d+\.\s*/, ''))

  const handlePrint = () => {
    const html = generatePrintHTML(recipe, restaurant, menuName, ingList, prepSteps)
    const win = window.open('', '_blank', 'width=960,height=720')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  return createPortal(
    <div
      id="print-only"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#f5f0e8',
        fontFamily: "'DM Sans', Arial, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      {/* ── TOOLBAR ── */}
      <div
        className="print-toolbar"
        style={{
          position: 'sticky',
          top: 0,
          background: '#222',
          padding: '10px 20px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          zIndex: 999999,
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#fff', fontSize: '0.85rem', flex: 1 }}>
          Vista previa de impresión
        </span>
        <button
          onClick={handlePrint}
          style={{
            background: '#c9a84c', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 20px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          🖨 Imprimir
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8, color: '#fff', padding: '8px 16px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ✕ Cerrar
        </button>
      </div>

      {/* ── PREVIEW — 2-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Header left */}
          <div style={{ background: '#111111', padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              {restaurant?.logoURL
                ? <img src={restaurant.logoURL} alt="Logo" style={{ width: 70, height: 50, objectFit: 'contain', borderRadius: 4 }} />
                : <div style={{ width: 70, height: 50, border: '1px dashed #444', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 9, textAlign: 'center', lineHeight: 1.3 }}>Sin<br />Logo</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#c9a84c', fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
                {restaurant?.name || 'RecetarioPro'}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: '#ffffff', fontWeight: 400, lineHeight: 1.3 }}>
                {recipe?.name}
              </div>
            </div>
          </div>

          {/* Photo */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, background: '#1a1a1a' }}>
            {recipe?.photoURL
              ? <img src={recipe.photoURL} alt={recipe.name} style={{ width: 180, height: 180, borderRadius: '50%', border: '3px solid #c9a84c', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: 180, height: 180, borderRadius: '50%', border: '3px solid #c9a84c', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🍽</div>
            }
          </div>

          {/* Info bar */}
          <div style={{ background: '#1a1a1a', padding: '14px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['Menú', menuName], ['Código', recipe?.code], ['Referencia', recipe?.reference]].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', width: 70 }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ background: '#f5f0e8', display: 'flex', flexDirection: 'column' }}>

          {/* Header right (spacer) */}
          <div style={{ background: '#111111', padding: '20px 24px', minHeight: 90 }} />

          {/* Ingredients + Preparation */}
          <div style={{ flex: 1, padding: '20px 24px' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', fontWeight: 700, marginBottom: 12 }}>
              Ingredientes
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', padding: '4px 8px 4px 0', fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', width: 60 }}>Cant.</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', width: 50 }}>Un.</th>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ingrediente</th>
                </tr>
              </thead>
              <tbody>
                {ingList.map((ing, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ textAlign: 'right', padding: '6px 8px 6px 0', fontSize: 12, color: '#333', fontWeight: 600 }}>{ing.quantity || ''}</td>
                    <td style={{ padding: '6px 8px', fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{ing.unit || ''}</td>
                    <td style={{ padding: '6px 0', fontSize: 11, color: '#111', fontWeight: 500 }}>{ing.description || ing.ingredientName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {prepSteps.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', fontWeight: 700, marginBottom: 10 }}>
                  Preparación
                </div>
                <div style={{ background: '#fff', borderRadius: 6, padding: 12, fontSize: 10, lineHeight: 1.9, color: '#333' }}>
                  {prepSteps.map((line, i) => (
                    <p key={i} style={{ margin: '0 0 4px 0' }}>{i + 1}. {line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer right */}
          <div style={{ background: '#111111', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 8, color: '#666' }}>RecetarioPro</span>
            <span style={{ fontSize: 8, color: '#666' }}>v{recipe?.version || 1} · {new Date().toLocaleDateString('es-CO')}</span>
          </div>

        </div>
      </div>

      {/* Watermark */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%) rotate(-35deg)',
        fontFamily: "'Playfair Display', serif",
        fontSize: 80, color: 'rgba(0,0,0,0.03)',
        whiteSpace: 'nowrap', pointerEvents: 'none', fontWeight: 700, zIndex: 0,
      }}>
        {restaurant?.name || 'RecetarioPro'}
      </div>

      <style>{`@media print { .print-toolbar { display: none !important; } }`}</style>
    </div>,
    document.body
  )
}
