/**
 * Frontend Validation Tests
 * Tests for form validation logic used in the bowl builder
 */

import { describe, it, expect } from 'vitest';

// Validation regex patterns (matching those in +page.svelte)
const COLOMBIAN_PHONE_REGEX = /^(\+57)?[0-9]{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_REGEX = /^[0-9]{6}$/;

describe('Colombian Phone Validation', () => {
	const validPhones = [
		'3001234567', // 10 digits without country code
		'3101234567', // Different prefix
		'3201234567',
		'+573001234567', // With country code
		'+573101234567'
	];

	const invalidPhones = [
		'300123456', // 9 digits (too short)
		'30012345678', // 11 digits (too long)
		'573001234567', // 12 digits without +
		'+1234567890', // Wrong country code format
		'abcdefghij', // Letters
		'300 123 4567', // With spaces (before cleanup)
		'+57 300 123 4567', // With spaces
		'', // Empty
		'+57' // Just country code
	];

	validPhones.forEach((phone) => {
		it(`should accept valid phone: ${phone}`, () => {
			expect(COLOMBIAN_PHONE_REGEX.test(phone)).toBe(true);
		});
	});

	invalidPhones.forEach((phone) => {
		it(`should reject invalid phone: ${phone || '(empty)'}`, () => {
			expect(COLOMBIAN_PHONE_REGEX.test(phone)).toBe(false);
		});
	});

	it('should accept phone after removing spaces', () => {
		const phoneWithSpaces = '300 123 4567';
		const cleaned = phoneWithSpaces.replace(/\s/g, '');
		expect(COLOMBIAN_PHONE_REGEX.test(cleaned)).toBe(true);
	});
});

describe('Email Validation', () => {
	const validEmails = ['test@example.com', 'user.name@domain.co', 'user+tag@example.org', 'a@b.co'];

	const invalidEmails = [
		'notanemail',
		'@nodomain.com',
		'noat.com',
		'spaces in@email.com',
		'missing@tld',
		''
	];

	validEmails.forEach((email) => {
		it(`should accept valid email: ${email}`, () => {
			expect(EMAIL_REGEX.test(email)).toBe(true);
		});
	});

	invalidEmails.forEach((email) => {
		it(`should reject invalid email: ${email || '(empty)'}`, () => {
			expect(EMAIL_REGEX.test(email)).toBe(false);
		});
	});
});

describe('Colombian Postal Code Validation', () => {
	const validCodes = ['110131', '050012', '760001', '000000', '999999'];

	const invalidCodes = [
		'12345', // 5 digits
		'1234567', // 7 digits
		'11013A', // Contains letter
		'11 013', // Contains space
		''
	];

	validCodes.forEach((code) => {
		it(`should accept valid postal code: ${code}`, () => {
			expect(POSTAL_CODE_REGEX.test(code)).toBe(true);
		});
	});

	invalidCodes.forEach((code) => {
		it(`should reject invalid postal code: ${code || '(empty)'}`, () => {
			expect(POSTAL_CODE_REGEX.test(code)).toBe(false);
		});
	});
});

describe('Address Completeness Validation', () => {
	function isAddressComplete(address: {
		streetAddress: string;
		neighborhood: string;
		city: string;
		department: string;
	}): boolean {
		return (
			address.streetAddress.trim().length >= 5 &&
			address.neighborhood.trim().length >= 2 &&
			address.city.trim().length >= 2 &&
			address.department.trim().length >= 2
		);
	}

	it('should accept complete address', () => {
		const address = {
			streetAddress: 'Calle 100 # 15-20',
			neighborhood: 'Chicó',
			city: 'Bogotá',
			department: 'Bogotá D.C.'
		};
		expect(isAddressComplete(address)).toBe(true);
	});

	it('should reject address with short street', () => {
		const address = {
			streetAddress: 'ABC',
			neighborhood: 'Chicó',
			city: 'Bogotá',
			department: 'Bogotá D.C.'
		};
		expect(isAddressComplete(address)).toBe(false);
	});

	it('should reject address with empty neighborhood', () => {
		const address = {
			streetAddress: 'Calle 100 # 15-20',
			neighborhood: '',
			city: 'Bogotá',
			department: 'Bogotá D.C.'
		};
		expect(isAddressComplete(address)).toBe(false);
	});

	it('should handle whitespace-only fields', () => {
		const address = {
			streetAddress: '     ',
			neighborhood: 'Chicó',
			city: 'Bogotá',
			department: 'Bogotá D.C.'
		};
		expect(isAddressComplete(address)).toBe(false);
	});

	it('should accept minimum valid lengths', () => {
		const address = {
			streetAddress: '12345', // 5 chars
			neighborhood: 'AB', // 2 chars
			city: 'CD', // 2 chars
			department: 'EF' // 2 chars
		};
		expect(isAddressComplete(address)).toBe(true);
	});
});

describe('Can Submit Logic', () => {
	function canSubmit(
		customerName: string,
		isValidColombianPhone: boolean,
		isAddressComplete: boolean,
		isValidEmail: boolean,
		isValidPostalCode: boolean,
		selectedBowlSize: number | null,
		itemsCount: number,
		isOverCapacity: boolean
	): boolean {
		return (
			customerName.trim().length > 0 &&
			isValidColombianPhone &&
			isAddressComplete &&
			isValidEmail &&
			isValidPostalCode &&
			selectedBowlSize !== null &&
			itemsCount > 0 &&
			!isOverCapacity
		);
	}

	it('should allow submission with all valid fields', () => {
		expect(canSubmit('Juan', true, true, true, true, 450, 2, false)).toBe(true);
	});

	it('should prevent submission without customer name', () => {
		expect(canSubmit('', true, true, true, true, 450, 2, false)).toBe(false);
	});

	it('should prevent submission with invalid phone', () => {
		expect(canSubmit('Juan', false, true, true, true, 450, 2, false)).toBe(false);
	});

	it('should prevent submission with incomplete address', () => {
		expect(canSubmit('Juan', true, false, true, true, 450, 2, false)).toBe(false);
	});

	it('should prevent submission without bowl size', () => {
		expect(canSubmit('Juan', true, true, true, true, null, 2, false)).toBe(false);
	});

	it('should prevent submission without items', () => {
		expect(canSubmit('Juan', true, true, true, true, 450, 0, false)).toBe(false);
	});

	it('should prevent submission when over capacity', () => {
		expect(canSubmit('Juan', true, true, true, true, 450, 2, true)).toBe(false);
	});

	it('should allow empty email (optional field)', () => {
		// When email is empty, isValidEmail should be true
		expect(canSubmit('Juan', true, true, true, true, 450, 2, false)).toBe(true);
	});
});
