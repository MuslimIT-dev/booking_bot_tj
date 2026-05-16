import axios from 'axios';

export const paymentService = {
  async generateInvoice(provider: 'DC' | 'ALIF' | 'ESCHATA', invoiceId: string, amount: number, comment: string) {
    
    switch (provider) {
      case 'ALIF':
        return { url: `https://alif.mobi{invoiceId}&amount=${amount}`, qr: null };
        
      case 'DC':
        return { url: `https://dc.tj{invoiceId}`, qr: null };
        
      case 'ESCHATA':
        return { url: `https://eschata.tj{invoiceId}`, qr: null };
        
      default:
        throw new Error('UNKNOWN_PROVIDER');
    }
  }
};
