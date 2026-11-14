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

// Label stock: 60 mm wide × 55 mm tall, one bowl per page.
const PAGE_W = 60;
const PAGE_H = 55;
const MARGIN = 2.5;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Helvetica on purpose and monochrome (black on white): the label printer is likely
// thermal, so no embedded font, no greys, no colour.
// Type scale in pt.
const TYPE = { small: 6, body: 7, name: 9 } as const;
const LINE = 1.15; // line height as a multiple of font size
const PT_TO_MM = 25.4 / 72;
const CAP_HEIGHT = 0.72; // Helvetica cap height, em; centres text in table rows
const lineH = (pt: number) => pt * PT_TO_MM * LINE;

// Nutrition table, in mm.
const TABLE = { padX: 1, padY: 0.3, borderThin: 0.15, borderThick: 0.5 } as const;
const GAP = 1; // vertical gap between blocks, mm

type Doc = InstanceType<typeof import('jspdf').jsPDF>;

// Shortens text to maxW, ending in "…", when it does not fit.
function truncate(doc: Doc, text: string, maxW: number): string {
	if (doc.getTextWidth(text) <= maxW) return text;
	while (text.length > 0 && doc.getTextWidth(text + '…') > maxW) text = text.slice(0, -1);
	return text.trimEnd() + '…';
}

// "Label: value" on one line, bold label, normal value.
function labelValue(doc: Doc, label: string, value: string, y: number): void {
	doc.setFontSize(TYPE.body);
	doc.setFont('helvetica', 'bold');
	doc.text(label, MARGIN, y);
	const labelW = doc.getTextWidth(label);
	doc.setFont('helvetica', 'normal');
	doc.text(truncate(doc, value, CONTENT_W - labelW), MARGIN + labelW, y);
}

// Wraps "Ingredientes: <list>" so its last baseline sits at most maxDrop mm below the first. The bold label shares the
// first line, so that line wraps narrower. Overflow rule: step the font down from
// TYPE.body to TYPE.small in 0.5 pt steps; if it still does not fit at TYPE.small,
// keep the lines that fit and end the last one with "…".
function fitIngredients(doc: Doc, label: string, list: string, maxDrop: number) {
	let pt: number = TYPE.body;
	for (;;) {
		doc.setFontSize(pt);
		doc.setFont('helvetica', 'bold');
		const labelW = doc.getTextWidth(label);
		doc.setFont('helvetica', 'normal');
		const first: string[] = doc.splitTextToSize(list, CONTENT_W - labelW);
		const rest: string[] =
			first.length > 1 ? doc.splitTextToSize(first.slice(1).join(' '), CONTENT_W) : [];
		const lines = [first[0] ?? '', ...rest];
		const maxLines = 1 + Math.max(0, Math.floor(maxDrop / lineH(pt)));
		if (lines.length <= maxLines || pt <= TYPE.small) {
			if (lines.length > maxLines) {
				lines.length = maxLines;
				const w = maxLines === 1 ? CONTENT_W - labelW : CONTENT_W;
				lines[maxLines - 1] = truncate(doc, lines[maxLines - 1] + '…', w);
			}
			return { pt, labelW, lines };
		}
		pt -= 0.5;
	}
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
		const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
		img.onload = () => {
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = reject;
		img.src = url;
	});
}

// Header logo, mm. Width follows the SVG's 81.21 × 67.05 viewBox.
const LOGO_H = 8;
const LOGO_W = (LOGO_H * 81.21) / 67.05;

function drawLabel(doc: Doc, order: AdminOrder, logoDataUrl: string | null): void {
	doc.setTextColor(0);
	doc.setDrawColor(0);
	const right = PAGE_W - MARGIN;

	// ── Header: logo, then "Bowl by" / name / "Síguenos" beside it ───
	if (logoDataUrl) {
		doc.addImage(logoDataUrl, 'PNG', MARGIN, MARGIN, LOGO_W, LOGO_H);
	} else {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(TYPE.small);
		doc.text('alGramo.', MARGIN, MARGIN + LOGO_H / 2);
	}
	const headerX = MARGIN + LOGO_W + GAP;
	const headerW = right - headerX;
	const bowlByY = MARGIN + TYPE.small * PT_TO_MM;
	const nameY = bowlByY + lineH(TYPE.name);
	doc.setFont('helvetica', 'italic');
	doc.setFontSize(TYPE.small);
	doc.text('Bowl by', headerX, bowlByY);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(TYPE.name);
	doc.text(truncate(doc, order.user.name, headerW), headerX, nameY);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(TYPE.small);
	doc.text('Síguenos @algramo.col', headerX, nameY + lineH(TYPE.small));
	const headerBottom = MARGIN + LOGO_H;

	// ── Bottom-up: nutrition table anchored to the bottom edge ───────
	// A short ingredient list leaves space in the middle rather than a
	// half-empty label.
	const rows: [string, string][] = [
		['Energía', `${Math.round(order.totalCalories)} kcal`],
		['Proteínas', `${formatNutrientValue(order.totalProteinG)} g`],
		['Carbs.', `${formatNutrientValue(order.totalCarbsG)} g`],
		['Grasas', `${formatNutrientValue(order.totalFatG)} g`],
		['Fibra', `${formatNutrientValue(order.totalFiberG)} g`]
	];
	const rowH = lineH(TYPE.body) + 2 * TABLE.padY;
	const tableBottom = PAGE_H - MARGIN;
	const tableTop = tableBottom - rows.length * rowH;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(TYPE.body);
	rows.forEach(([label, value], i) => {
		const rowBottom = tableTop + (i + 1) * rowH;
		const baseline = rowBottom - rowH / 2 + (CAP_HEIGHT * TYPE.body * PT_TO_MM) / 2;
		doc.text(label, MARGIN + TABLE.padX, baseline);
		doc.text(value, right - TABLE.padX, baseline, { align: 'right' });
		if (i < rows.length - 1) {
			doc.setLineWidth(TABLE.borderThin);
			doc.line(MARGIN, rowBottom, right, rowBottom);
		}
	});
	doc.setLineWidth(TABLE.borderThick);
	doc.line(MARGIN, tableTop, right, tableTop);
	doc.line(MARGIN, tableBottom, right, tableBottom);
	doc.setLineWidth(TABLE.borderThin);
	doc.line(MARGIN, tableTop, MARGIN, tableBottom);
	doc.line(right, tableTop, right, tableBottom);

	const headingY = tableTop - GAP;
	doc.setFont('helvetica', 'bold');
	doc.text('Información Nutricional', MARGIN, headingY);

	// ── Top-down: Peso, Ingredientes, Precio ─────────────────────────
	let y = headerBottom + GAP + TYPE.body * PT_TO_MM;
	labelValue(doc, 'Peso: ', `${order.totalWeightG} g.`, y);
	y += lineH(TYPE.body);

	// Whatever is left above Precio (which must clear the table heading) goes to
	// the ingredients.
	const lastPrecioY = headingY - lineH(TYPE.body) - GAP;
	const ingLabel = 'Ingredientes: ';
	const ing = fitIngredients(
		doc,
		ingLabel,
		buildIngredientList(order.items),
		lastPrecioY - lineH(TYPE.body) - y
	);
	doc.setFontSize(ing.pt);
	doc.setFont('helvetica', 'bold');
	doc.text(ingLabel, MARGIN, y);
	doc.setFont('helvetica', 'normal');
	ing.lines.forEach((line, i) => {
		doc.text(line, i === 0 ? MARGIN + ing.labelW : MARGIN, y + i * lineH(ing.pt));
	});
	y += (ing.lines.length - 1) * lineH(ing.pt) + lineH(TYPE.body);

	labelValue(doc, 'Precio: ', `${formatPrice(order.totalPrice)}.`, y);
}

// One page per bowl (each AdminOrder is one bowl).
export async function buildLabelPdf(orders: AdminOrder[]): Promise<Doc> {
	// Dynamic import — runs only in the browser on button click
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W, PAGE_H] });

	let logoDataUrl: string | null = null;
	try {
		// Rasterise at 300 dpi-ish (× 4 in svgRawToDataUrl); addImage places it at LOGO_W × LOGO_H mm
		const pxPerMm = 96 / 25.4;
		logoDataUrl = await svgRawToDataUrl(
			logoSvgRaw,
			Math.round(LOGO_W * pxPerMm),
			Math.round(LOGO_H * pxPerMm)
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
