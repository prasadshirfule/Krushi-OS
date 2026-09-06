import QRCode from 'qrcode';

/**
 * Builds a standard, compliant UPI payment URI.
 * Conceptual format: upi://pay?pa=maulikrushi@upi&pn=MAULI%20KRUSHI%20KENDRA&am=266.00&cu=INR
 * 
 * Securely uses only Shop UPI ID, Shop Name, Amount, and Currency (INR).
 * Never includes sensitive customer information.
 */
export function buildUpiUri(
  upiId?: string | null,
  shopName?: string | null,
  amount: number = 0
): string {
  const cleanUpi = (upiId || '').trim();
  if (!cleanUpi) return '';

  const cleanShop = (shopName || 'KRUSHI SEVA KENDRA').trim().toUpperCase();
  const formattedAmount = Math.max(0, Number(amount || 0)).toFixed(2);
  const encodedShop = encodeURIComponent(cleanShop);

  return `upi://pay?pa=${cleanUpi}&pn=${encodedShop}&am=${formattedAmount}&cu=INR`;
}

/**
 * Generates a base64 Data URL (image/png) for a given text / UPI URI locally.
 * Generates completely client/server-side with zero external API calls.
 */
export async function generateQrDataUrl(
  text: string,
  options: { width?: number; margin?: number } = {}
): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, {
      width: options.width || 256,
      margin: options.margin !== undefined ? options.margin : 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR Data URL:', err);
    return '';
  }
}
