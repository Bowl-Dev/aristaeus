import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ConfirmModal from '../organisms/ConfirmModal.svelte';

const makeProps = (overrides: Record<string, unknown> = {}) => ({
	open: true,
	title: 'Remove this bowl?',
	message: 'Bowl 1 will be removed from your cart.',
	confirmLabel: 'Delete',
	cancelLabel: 'Cancel',
	onConfirm: vi.fn(),
	onCancel: vi.fn(),
	variant: 'danger' as const,
	...overrides
});

describe('ConfirmModal', () => {
	it('renders title, message and both buttons when open', () => {
		const { getByText } = render(ConfirmModal, { props: makeProps() });
		expect(getByText('Remove this bowl?')).toBeTruthy();
		expect(getByText('Bowl 1 will be removed from your cart.')).toBeTruthy();
		expect(getByText('Delete')).toBeTruthy();
		expect(getByText('Cancel')).toBeTruthy();
	});

	it('renders nothing when open is false', () => {
		const { queryByText } = render(ConfirmModal, { props: makeProps({ open: false }) });
		expect(queryByText('Remove this bowl?')).toBeNull();
	});

	it('calls onConfirm when the confirm button is clicked', async () => {
		const onConfirm = vi.fn();
		const { getByText } = render(ConfirmModal, { props: makeProps({ onConfirm }) });
		await fireEvent.click(getByText('Delete'));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it('calls onCancel when the cancel button is clicked', async () => {
		const onCancel = vi.fn();
		const { getByText } = render(ConfirmModal, { props: makeProps({ onCancel }) });
		await fireEvent.click(getByText('Cancel'));
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('dismisses (onCancel) on Escape key', async () => {
		const onCancel = vi.fn();
		render(ConfirmModal, { props: makeProps({ onCancel }) });
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('dismisses (onCancel) on click outside the dialog body', async () => {
		const onCancel = vi.fn();
		render(ConfirmModal, { props: makeProps({ onCancel }) });
		// A pointerdown on document.body is outside the dialog body element.
		await fireEvent.pointerDown(document.body);
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('does not dismiss when pointerdown lands inside the dialog body', async () => {
		const onCancel = vi.fn();
		const { getByText } = render(ConfirmModal, { props: makeProps({ onCancel }) });
		await fireEvent.pointerDown(getByText('Remove this bowl?'));
		expect(onCancel).not.toHaveBeenCalled();
	});
});
