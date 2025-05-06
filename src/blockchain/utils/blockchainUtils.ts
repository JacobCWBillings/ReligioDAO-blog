// src/blockchain/utils/blockchainUtils.ts
import { ethers } from 'ethers';

/**
 * Converts a blockchain numeric value to a JavaScript number
 * Safely handles ethers.js BigNumber values (for both v5 and v6)
 * 
 * @param value Value to convert (BigNumber, bigint, string, or number)
 * @param defaultValue Optional default value if conversion fails
 * @returns JavaScript number
 */
export function toNumber(value: unknown, defaultValue: number = 0): number {
  try {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    
    // Handle ethers v6 bigint
    if (typeof value === 'bigint') {
      return Number(value);
    }
    
    // Handle strings that might be numeric
    if (typeof value === 'string') {
      if (value.trim() === '') {
        return defaultValue;
      }
      return Number(value);
    }
    
    // Handle plain numbers
    if (typeof value === 'number') {
      return value;
    }
    
    // Handle ethers v5 BigNumber objects with a toNumber method
    if (typeof value === 'object' && value !== null && 'toNumber' in value && 
        typeof (value as any).toNumber === 'function') {
      return (value as any).toNumber();
    }
    
    // Handle ethers v6 BigNumber objects that can be coerced
    if (typeof value === 'object' && value !== null && 'toString' in value && 
        typeof (value as any).toString === 'function') {
      return Number((value as any).toString());
    }
    
    // Try a direct number conversion as a last resort
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  } catch (err) {
    console.error('Error converting blockchain value to number:', err);
    return defaultValue;
  }
}

/**
 * Converts a blockchain timestamp (seconds) to JavaScript Date timestamp (milliseconds)
 * 
 * @param timestamp Blockchain timestamp in seconds
 * @returns JavaScript timestamp in milliseconds
 */
export function blockchainTimeToJsTime(timestamp: unknown): number {
  const seconds = toNumber(timestamp, 0);
  return seconds * 1000; // Convert seconds to milliseconds
}

/**
 * Converts a JavaScript timestamp (milliseconds) to blockchain time (seconds)
 * 
 * @param jsTimestamp JavaScript timestamp in milliseconds
 * @returns Blockchain timestamp in seconds
 */
export function jsTimeToBlockchainTime(jsTimestamp: number): number {
  return Math.floor(jsTimestamp / 1000); // Convert milliseconds to seconds
}

/**
 * Formats a blockchain address for display
 * Shows the first 6 and last 4 characters with ellipsis in between
 * 
 * @param address Ethereum address
 * @param chars Number of characters to display at start and end
 * @returns Formatted address string
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (!address || address.length < (startChars + endChars + 3)) {
    return address || '';
  }
  
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Formats blockchain balance for display with proper decimal places
 * 
 * @param balance Balance value
 * @param decimals Number of decimals
 * @param displayDecimals Number of decimals to display
 * @returns Formatted balance string
 */
export function formatBalance(balance: unknown, decimals: number = 18, displayDecimals: number = 4): string {
  try {
    const value = toNumber(balance, 0);
    const divisor = Math.pow(10, decimals);
    const formatted = (value / divisor).toFixed(displayDecimals);
    return formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
  } catch (err) {
    console.error('Error formatting blockchain balance:', err);
    return '0';
  }
}

/**
 * Converts hex string to a number
 * 
 * @param hex Hex string (with or without 0x prefix)
 * @param defaultValue Default value if conversion fails
 * @returns JavaScript number
 */
export function hexToNumber(hex: string, defaultValue: number = 0): number {
  try {
    if (!hex) return defaultValue;
    
    // Ensure proper prefix
    const prefixedHex = hex.startsWith('0x') ? hex : `0x${hex}`;
    
    // Use ethers.js parsing
    return Number(ethers.getBigInt(prefixedHex));
  } catch (err) {
    console.error('Error converting hex to number:', err);
    return defaultValue;
  }
}