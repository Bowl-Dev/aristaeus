import type { AdminOrder, AdminOrderItem } from '$lib/api/client';
import esTranslations from '$lib/i18n/es.json';
// Bundled at build time — no runtime fetch, no base-path issues on any deployment
import logoSvgRaw from '$lib/assets/algramo-logo.svg?raw';

// Always render the label in Spanish, regardless of the app's current locale.
const ingredientTranslations = esTranslations.ingredients as Record<string, string>;

function translateIngredient(name: string): string {
	return ingredientTranslations[name] ?? name;
}

// Matches the price formatting used in MenuView.svelte
function formatPrice(cop: number): string {
	return `$${cop.toLocaleString('es-CO')}`;
}

function formatNutrientValue(value: number): string {
	return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

function buildIngredientList(items: AdminOrderItem[]): string {
	const sorted = [...items].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
	const parts = sorted.map(
		(item) => `${translateIngredient(item.ingredientName)} ${item.quantityGrams}g`
	);
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

export async function generateLabel(order: AdminOrder): Promise<void> {
	// Dynamic import — runs only in the browser on button click
	const { jsPDF } = await import('jspdf');

	// A4 landscape: 297 × 210 mm
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

	// ── Layout constants ──────────────────────────────────────────────
	const margin = 6;

	// Left column is wide enough for 30 pt "Ingredientes: X..." to start inline
	const leftColW = 130;
	const colGap = 8;
	const rightColX = margin + leftColW + colGap; // 151 mm

	// Table is narrower than the full remaining width (more compact sideways)
	const tableW = 118;

	// Body text: 30 pt (matching the original 30 pt Inter)
	const BODY_PT = 30;
	const rowH = 13.5; // row/line height in mm (30 pt × 0.3528 × 1.25 ≈ 13.2)

	// Border widths (1 px = 0.265 mm at 96 dpi; 4 px = 1.058 mm)
	const BORDER_THIN = 0.26; // 1 px — sides and row dividers
	const BORDER_THICK = 1.06; // 4 px — top and bottom of table

	// ── HEADER — logo + "Bowl by" + customer name ────────────────────
	const logoW = 46;
	const logoH = 38;
	const logoX = margin;
	const logoY = 4;

	try {
		// Convert mm → px (96 dpi) for the canvas rasterisation size
		const pxPerMm = 96 / 25.4;
		const logoDataUrl = await svgRawToDataUrl(
			logoSvgRaw,
			Math.round(logoW * pxPerMm),
			Math.round(logoH * pxPerMm)
		);
		doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
	} catch {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(BODY_PT);
		doc.text('Gr.', logoX, logoY + logoH - 4);
	}

	const textX = logoX + logoW + 6;

	doc.setFont('helvetica', 'italic');
	doc.setFontSize(14);
	doc.text('Bowl by', textX, logoY + 12);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(28);
	doc.text(order.user.name, textX, logoY + 25);

	// ── LEFT COLUMN — Peso, Ingredientes, Precio ─────────────────────
	// Body starts below logo with a natural gap (no separator line)
	let leftY = logoY + logoH + 12; // ≈ 58 mm
	const leftX = margin;

	// Peso
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(BODY_PT);
	const pesoLabel = 'Peso:';
	doc.text(pesoLabel, leftX, leftY);
	doc.setFont('helvetica', 'normal');
	doc.text(` ${order.totalWeightG} g.`, leftX + doc.getTextWidth(pesoLabel), leftY);
	leftY += rowH;
	leftY += 4; // gap

	// Ingredientes — bold label, then ingredient text inline on first line
	const ingLabel = 'Ingredientes: ';
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(BODY_PT);
	doc.text(ingLabel, leftX, leftY);
	const ingLabelW = doc.getTextWidth(ingLabel);

	const ingredientList = buildIngredientList(order.items);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(BODY_PT);

	// Split at the narrower first-line width (column minus the bold label)
	const firstLineMaxW = leftColW - ingLabelW;
	const firstLineSplit = doc.splitTextToSize(ingredientList, firstLineMaxW);
	doc.text(firstLineSplit[0], leftX + ingLabelW, leftY);
	leftY += rowH;

	if (firstLineSplit.length > 1) {
		// Re-join remainder, re-split at full column width, then justify
		const remainingText = firstLineSplit.slice(1).join(' ');
		const remainingLines = doc.splitTextToSize(remainingText, leftColW);
		doc.text(remainingLines, leftX, leftY, { align: 'justify', maxWidth: leftColW });
		leftY += remainingLines.length * rowH;
	}

	leftY += 5; // gap before Precio

	// Precio
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(BODY_PT);
	const precioLabel = 'Precio:';
	doc.text(precioLabel, leftX, leftY);
	doc.setFont('helvetica', 'normal');
	doc.text(` ${formatPrice(order.totalPrice)}.`, leftX + doc.getTextWidth(precioLabel), leftY);

	// ── RIGHT COLUMN — Información nutricional + table ───────────────
	let rightY = logoY + logoH + 12; // same body start as left column

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(BODY_PT);
	doc.text('Información nutricional', rightColX, rightY);
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
	doc.setLineWidth(BORDER_THICK);
	doc.setDrawColor(0);
	doc.line(tableX, tableTop, tableX + tableW, tableTop);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(BODY_PT);

	rows.forEach(([label, value], i) => {
		const textY = tableTop + i * rowH + rowH - 3.5;
		doc.text(label, tableX + 3, textY);
		doc.text(value, tableX + tableW - 3, textY, { align: 'right' });

		// Thin row divider (1 px), not after the last row
		if (i < rows.length - 1) {
			doc.setLineWidth(BORDER_THIN);
			doc.line(tableX, tableTop + (i + 1) * rowH, tableX + tableW, tableTop + (i + 1) * rowH);
		}
	});

	const tableBottom = tableTop + rows.length * rowH;

	// Thick bottom border (4 px)
	doc.setLineWidth(BORDER_THICK);
	doc.line(tableX, tableBottom, tableX + tableW, tableBottom);

	// Thin side borders (1 px)
	doc.setLineWidth(BORDER_THIN);
	doc.line(tableX, tableTop, tableX, tableBottom);
	doc.line(tableX + tableW, tableTop, tableX + tableW, tableBottom);

	// alGramo. — right-aligned with the table's right edge
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(12);
	doc.text('alGramo.', tableX + tableW, tableBottom + 8, { align: 'right' });

	// ── Save ─────────────────────────────────────────────────────────
	const safeName = order.user.name.replaceAll(' ', '_');
	doc.save(`etiqueta-pedido-${order.id}-${safeName}.pdf`);
}
