import type { AdminOrder, AdminOrderItem } from '$lib/api/client';
import { CATEGORY_ORDER } from '$lib/constants';

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

function drawLabel(doc: Doc, order: AdminOrder): void {
	doc.setTextColor(0);
	doc.setDrawColor(0);
	const right = PAGE_W - MARGIN;

	// ── Bottom-up: footer, then the nutrition table above it ─────────
	// Anchored to the bottom so a short ingredient list leaves space in the
	// middle rather than a half-empty label.
	// Footer: "Bowl by" / name on the left, "alGramo." / "Síguenos" on the right.
	const footerLine2 = PAGE_H - MARGIN;
	const footerLine1 = footerLine2 - lineH(TYPE.name); // room for accents on the name line
	const follow = 'Síguenos @algramo.col';

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(TYPE.small);
	doc.text(follow, right, footerLine2, { align: 'right' });
	const followW = doc.getTextWidth(follow);
	doc.setFont('helvetica', 'italic');
	doc.text('Bowl by', MARGIN, footerLine1);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(TYPE.name);
	doc.text('alGramo.', right, footerLine1, { align: 'right' });
	doc.text(truncate(doc, order.user.name, CONTENT_W - followW - GAP), MARGIN, footerLine2);

	const rows: [string, string][] = [
		['Energía', `${Math.round(order.totalCalories)} kcal`],
		['Proteínas', `${formatNutrientValue(order.totalProteinG)} g`],
		['Carbs.', `${formatNutrientValue(order.totalCarbsG)} g`],
		['Grasas', `${formatNutrientValue(order.totalFatG)} g`],
		['Fibra', `${formatNutrientValue(order.totalFiberG)} g`]
	];
	const rowH = lineH(TYPE.body) + 2 * TABLE.padY;
	const tableBottom = footerLine1 - lineH(TYPE.name) - GAP;
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
	let y = MARGIN + TYPE.body * PT_TO_MM;
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
	orders.forEach((order, i) => {
		if (i > 0) doc.addPage();
		drawLabel(doc, order);
	});
	return doc;
}

export async function generateLabel(orders: AdminOrder[]): Promise<void> {
	const doc = await buildLabelPdf(orders);
	const safeName = orders[0].user.name.replaceAll(' ', '_');
	doc.save(`etiqueta-pedido-${orders[0].id}-${safeName}.pdf`);
}
