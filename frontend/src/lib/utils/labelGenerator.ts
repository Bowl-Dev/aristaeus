import type { AdminOrder, AdminOrderItem } from '$lib/api/client';
import { CATEGORY_ORDER } from '$lib/constants';
// Bundled at build time — no runtime fetch, no base-path issues on any deployment
import logoSvgRaw from '$lib/assets/algramo-logo.svg?raw';

// Matches the price formatting used in MenuView.svelte
function formatPrice(cop: number): string {
	return `$${cop.toLocaleString('es-CO')}`;
}

function formatNutrientValue(value: number): string {
	return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

// Unknown categories sort after every known one instead of ahead of them,
// which a bare `indexOf` (-1) would do.
function categoryRank(category: string): number {
	const index = CATEGORY_ORDER.indexOf(category);
	return index === -1 ? CATEGORY_ORDER.length : index;
}

// The label reads in the same category order as the Builder and the kitchen
// view (CATEGORY_ORDER), not in robot assembly order. `sequenceOrder` still
// breaks ties so items within a category keep their assembly sequence.
// ponytail: hand-rolled "a, b y c" joining; Intl.ListFormat('es') does it, including
// the cases this does not (one item, empty). Swap when the label copy next changes.
export function buildIngredientList(items: AdminOrderItem[]): string {
	const sorted = [...items].sort(
		(a, b) =>
			categoryRank(a.ingredientCategory) - categoryRank(b.ingredientCategory) ||
			a.sequenceOrder - b.sequenceOrder
	);
	const parts = sorted.map((item) => `${item.ingredientNameEs} ${item.quantityGrams}g`);
	if (parts.length === 0) return '';
	if (parts.length === 1) return parts[0] + '.';
	const last = parts.pop()!;
	return parts.join(', ') + ' y ' + last + '.';
}

// Rasterises a raw SVG string onto a canvas and returns a high-DPI PNG data URL.
// jsPDF cannot embed SVG natively, so we draw through the browser's canvas.
function svgRawToDataUrl(svgText: string, widthPx: number, heightPx: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		const scale = 4; // 4× for crisp print output
		canvas.width = widthPx * scale;
		canvas.height = heightPx * scale;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			reject(new Error('No 2D context'));
			return;
		}

		const img = new Image();
		const blob = new Blob([svgText], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		img.onload = () => {
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = reject;
		img.src = url;
	});
}

// Label stock: 60 mm wide × 55 mm tall, one bowl per page.
const PAGE_W = 60;
const PAGE_H = 55;

// The layout below is the original A4-landscape design (297 × 210 mm, 30 pt
// body), drawn through `s()` so the whole thing shrinks uniformly onto the
// label: positions, line widths and font sizes all scale by the same factor.
const DESIGN_W = 297;
const DESIGN_H = 210;
const SCALE = Math.min(PAGE_W / DESIGN_W, PAGE_H / DESIGN_H);
const s = (v: number) => v * SCALE;

// ── Layout constants (design units, A4 mm / pt) ──────────────────────
const margin = 6;

// Left column is wide enough for "Ingredientes: X..." to start inline
const leftColW = 130;
const colGap = 8;
const rightColX = margin + leftColW + colGap;

// Table is narrower than the full remaining width (more compact sideways)
const tableW = 118;

const BODY_PT = 30;
const rowH = 13.5; // row/line height (30 pt × 0.3528 × 1.25 ≈ 13.2)

// Border widths (1 px = 0.265 mm at 96 dpi; 4 px = 1.058 mm)
const BORDER_THIN = 0.26; // 1 px — sides and row dividers
const BORDER_THICK = 1.06; // 4 px — top and bottom of table

const logoW = 46;
const logoH = 38;
const logoX = margin;
const logoY = 4;

type Doc = InstanceType<typeof import('jspdf').jsPDF>;

function drawLabel(doc: Doc, order: AdminOrder, logoDataUrl: string | null): void {
	// ── HEADER — logo + "Bowl by" + customer name ────────────────────
	if (logoDataUrl) {
		doc.addImage(logoDataUrl, 'PNG', s(logoX), s(logoY), s(logoW), s(logoH));
	} else {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(s(BODY_PT));
		doc.text('Gr.', s(logoX), s(logoY + logoH - 4));
	}

	const textX = logoX + logoW + 6;

	doc.setFont('helvetica', 'italic');
	doc.setFontSize(s(14));
	doc.text('Bowl by', s(textX), s(logoY + 12));

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(s(28));
	doc.text(order.user.name, s(textX), s(logoY + 25));

	// ── LEFT COLUMN — Peso, Ingredientes, Precio ─────────────────────
	// Body starts below logo with a natural gap (no separator line)
	let leftY = logoY + logoH + 12;
	const leftX = margin;

	// Peso
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(s(BODY_PT));
	const pesoLabel = 'Peso:';
	doc.text(pesoLabel, s(leftX), s(leftY));
	doc.setFont('helvetica', 'normal');
	doc.text(` ${order.totalWeightG} g.`, s(leftX) + doc.getTextWidth(pesoLabel), s(leftY));
	leftY += rowH;
	leftY += 4; // gap

	// Ingredientes — bold label, then ingredient text inline on first line
	const ingLabel = 'Ingredientes: ';
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(s(BODY_PT));
	doc.text(ingLabel, s(leftX), s(leftY));
	const ingLabelW = doc.getTextWidth(ingLabel);

	const ingredientList = buildIngredientList(order.items);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(s(BODY_PT));

	// Split at the narrower first-line width (column minus the bold label)
	const firstLineSplit = doc.splitTextToSize(ingredientList, s(leftColW) - ingLabelW);
	doc.text(firstLineSplit[0], s(leftX) + ingLabelW, s(leftY));
	leftY += rowH;

	if (firstLineSplit.length > 1) {
		// Re-join remainder, re-split at full column width, then justify
		const remainingText = firstLineSplit.slice(1).join(' ');
		const remainingLines = doc.splitTextToSize(remainingText, s(leftColW));
		doc.text(remainingLines, s(leftX), s(leftY), { align: 'justify', maxWidth: s(leftColW) });
		leftY += remainingLines.length * rowH;
	}

	leftY += 5; // gap before Precio

	// Precio
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(s(BODY_PT));
	const precioLabel = 'Precio:';
	doc.text(precioLabel, s(leftX), s(leftY));
	doc.setFont('helvetica', 'normal');
	doc.text(
		` ${formatPrice(order.totalPrice)}.`,
		s(leftX) + doc.getTextWidth(precioLabel),
		s(leftY)
	);

	// ── RIGHT COLUMN — Información nutricional + table ───────────────
	let rightY = logoY + logoH + 12; // same body start as left column

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(s(BODY_PT));
	doc.text('Información nutricional', s(rightColX), s(rightY));
	rightY += rowH - 2; // slight tuck before table

	const rows: [string, string][] = [
		['Energía', `${Math.round(order.totalCalories)} kcal`],
		['Proteínas', `${formatNutrientValue(order.totalProteinG)} g`],
		['Grasas', `${formatNutrientValue(order.totalFatG)} g`],
		['Carbohidratos', `${formatNutrientValue(order.totalCarbsG)} g`],
		['Fibra', `${formatNutrientValue(order.totalFiberG)} g`]
	];

	const tableX = rightColX;
	const tableTop = rightY + 1;

	// Thick top border (4 px)
	doc.setLineWidth(s(BORDER_THICK));
	doc.setDrawColor(0);
	doc.line(s(tableX), s(tableTop), s(tableX + tableW), s(tableTop));

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(s(BODY_PT));

	rows.forEach(([label, value], i) => {
		const textY = tableTop + i * rowH + rowH - 3.5;
		doc.text(label, s(tableX + 3), s(textY));
		doc.text(value, s(tableX + tableW - 3), s(textY), { align: 'right' });

		// Thin row divider (1 px), not after the last row
		if (i < rows.length - 1) {
			const divY = tableTop + (i + 1) * rowH;
			doc.setLineWidth(s(BORDER_THIN));
			doc.line(s(tableX), s(divY), s(tableX + tableW), s(divY));
		}
	});

	const tableBottom = tableTop + rows.length * rowH;

	// Thick bottom border (4 px)
	doc.setLineWidth(s(BORDER_THICK));
	doc.line(s(tableX), s(tableBottom), s(tableX + tableW), s(tableBottom));

	// Thin side borders (1 px)
	doc.setLineWidth(s(BORDER_THIN));
	doc.line(s(tableX), s(tableTop), s(tableX), s(tableBottom));
	doc.line(s(tableX + tableW), s(tableTop), s(tableX + tableW), s(tableBottom));

	// alGramo. — right-aligned with the table's right edge
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(s(12));
	doc.text('alGramo.', s(tableX + tableW), s(tableBottom + 8), { align: 'right' });
}

// One page per bowl (each AdminOrder is one bowl).
export async function buildLabelPdf(orders: AdminOrder[]): Promise<Doc> {
	// Dynamic import — runs only in the browser on button click
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W, PAGE_H] });

	let logoDataUrl: string | null = null;
	try {
		// Rasterise at the design size (96 dpi); addImage scales it down to the label
		const pxPerMm = 96 / 25.4;
		logoDataUrl = await svgRawToDataUrl(
			logoSvgRaw,
			Math.round(logoW * pxPerMm),
			Math.round(logoH * pxPerMm)
		);
	} catch {
		// drawLabel falls back to a text mark
	}

	orders.forEach((order, i) => {
		if (i > 0) doc.addPage();
		drawLabel(doc, order, logoDataUrl);
	});
	return doc;
}

export async function generateLabel(orders: AdminOrder[]): Promise<void> {
	const doc = await buildLabelPdf(orders);
	const safeName = orders[0].user.name.replaceAll(' ', '_');
	doc.save(`etiqueta-pedido-${orders[0].id}-${safeName}.pdf`);
}
