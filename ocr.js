let worker = null;


async function initWorker() {
    if (worker) return worker;
    try {
        worker = await Tesseract.createWorker('eng', 1, {
            logger: progress => {
                const hint = document.getElementById('receipt-hint');
                if (hint && progress.status === 'recognizing text') {
                    hint.textContent = `Processing image... ${Math.round(progress.progress * 100)}%`;
                }
            }
        });
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        console.log('OCR worker ready');
        return worker;
    } catch (err) {
        console.error('Failed to initialize OCR:', err);
        throw new Error('Could not initialize text recognition. Please try again.');
    }
}


async function terminateWorker() {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
}

// Extract text from image
async function recognizeText(file) {
    try {
        const w = await initWorker();
        const result = await w.recognize(file);
        return result.data.text;
    } finally {
        const hint = document.getElementById('receipt-hint');
        if (hint) hint.textContent = 'Upload a photo or scan of your receipt and we\'ll try to extract the purchase date.';
    }
}

// Find and parse the first valid date in text
function findFirstDateInText(text) {
    if (!text) return null;
    
    // Normalize text: remove excess spaces, convert common OCR errors
    text = text
        .replace(/\u00A0/g, ' ')              
        .replace(/[|!lI]/g, '1')              
        .replace(/[oO]/g, '0')                
        .replace(/(\d)\s+(?=\d)/g, '$1')      // remove spaces between digits
        .replace(/[^\w\s\d\/\-\.]/g, ' ')     // keep only word chars, spaces, digits, and date separators
        .trim();

    // Date patterns
    const patterns = [
        
            /\b(20\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,
        
          
            /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](?:20)?(\d{2})\b/,

        /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(?:20)?(\d{2})\b/i
    ];

    for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (!matches) continue;

        try {
            let year, month, day;

            if (matches[0].includes('/') || matches[0].includes('-') || matches[0].includes('.')) {
                // Numeric date parts
                if (matches[1].length === 4) {
     
                    [, year, month, day] = matches;
                } else {
                 
                    const [a, b, y] = matches.slice(1);
                    year = y.length === 2 ? '20' + y : y;
                    
                    [day, month] = [a, b];
                }
            } else {
              
                const monthMap = {
                    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
                    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
                };
                const monthText = matches[0].match(/[A-Za-z]+/)[0].toLowerCase().slice(0,3);
                month = monthMap[monthText];
                    [, day, year] = matches;
                    year = year.length === 2 ? '20' + year : year;
            }


            year = parseInt(year);
            month = parseInt(month);
            day = parseInt(day);

            if (year < 2000 || year > 2100) continue;  
            if (month < 1 || month > 12) continue;
            if (day < 1 || day > 31) continue;

        
            const date = new Date(year, month - 1, day);
            if (date.getMonth() !== month - 1) continue; 

        
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } catch (e) {
            console.warn('Date parse failed:', e);
            continue;
        }
    }
    return null;
}

// Main handler for receipt file selection
async function handleReceiptFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Please upload an image file (photo or scan of receipt).');
    }

    const hint = document.getElementById('receipt-hint');
    if (hint) hint.textContent = 'Processing image... (initializing)';

    try {
        const text = await recognizeText(file);
        console.log('Extracted text:', text);
        console.log('Looking for dates and warranty period...');

        if (!text || text.trim().length === 0) {
            throw new Error('No text could be extracted from the image. Try a clearer photo.');
        }

        const date = findFirstDateInText(text);
        if (!date) {
            throw new Error('No valid date found in the receipt. Try a clearer photo or enter the date manually.');
        }

  
        let duration = null;
        
        // Pattern 1: Date range (from X to Y)
        const periodMatch = text.match(/warranty\s+period:?\s*(?:from\s+)?([0-9\.\/\-]+)\s+to\s+([0-9\.\/\-]+)/i);
        if (periodMatch) {
            const startDate = findFirstDateInText(periodMatch[1]);
            const endDate = findFirstDateInText(periodMatch[2]);
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                             (end.getMonth() - start.getMonth());
                if (months > 0) duration = months;
            }
        }
        
        // Pattern 2: X year(s) warranty/guarantee
        if (!duration) {
            const yearMatch = text.match(/(\d+)[\s-]*(year|yr)s?\s*(warranty|guarantee|coverage)/i);
            if (yearMatch) {
                duration = parseInt(yearMatch[1]) * 12;
            }
        }
        
        // Pattern 3: X month warranty/coverage
        if (!duration) {
            const monthMatch = text.match(/(\d+)[\s-]*(month|mo)s?\s*(warranty|guarantee|coverage)/i);
            if (monthMatch) {
                duration = parseInt(monthMatch[1]);
            }
        }
        
        // Pattern 4: Valid/Covered for X years/months
        if (!duration) {
            const validMatch = text.match(/(?:valid|covered)\s+for\s+(\d+)\s*(year|yr|month|mo)s?/i);
            if (validMatch) {
                const num = parseInt(validMatch[1]);
                duration = validMatch[2].toLowerCase().startsWith('y') ? num * 12 : num;
            }
        }
        
        // Pattern 5: Warranty term/duration: X years/months
        if (!duration) {
            const termMatch = text.match(/(?:warranty|guarantee)\s+(?:term|duration|period):\s*(\d+)\s*(year|yr|month|mo)s?/i);
            if (termMatch) {
                const num = parseInt(termMatch[1]);
                duration = termMatch[2].toLowerCase().startsWith('y') ? num * 12 : num;
            }
        }
        
        // Pattern 6: Extended warranty for X years/months
        if (!duration) {
            const extendedMatch = text.match(/extended\s+(?:warranty|guarantee|coverage|service)\s+(?:for|of)\s+(\d+)\s*(year|yr|month|mo)s?/i);
            if (extendedMatch) {
                const num = parseInt(extendedMatch[1]);
                duration = extendedMatch[2].toLowerCase().startsWith('y') ? num * 12 : num;
            }
        }

        // Pattern 7: "for a period of X Year(s)" format
        if (!duration) {
            const periodOfMatch = text.match(/(?:for\s+a\s+)?period\s+of\s+(\d+)\s*(year|yr|month|mo)s?\s+(?:commencing|starting|beginning)?/i);
            if (periodOfMatch) {
                const num = parseInt(periodOfMatch[1]);
                duration = periodOfMatch[2].toLowerCase().startsWith('y') ? num * 12 : num;
            }
        }

        // Pattern 8: Limited Warranty for X year
        if (!duration) {
            const limitedMatch = text.match(/limited\s+warranty\s+(?:for|of)\s+(\d+)\s*(year|yr|month|mo)s?/i);
            if (limitedMatch) {
                const num = parseInt(limitedMatch[1]);
                duration = limitedMatch[2].toLowerCase().startsWith('y') ? num * 12 : num;
            }
        }
        
        console.log('Duration patterns checked, found:', duration, 'months');

        const mainDateInput = document.getElementById('purchase-date');
        const editDateInput = document.getElementById('purchase-date-edit');
        const mainDurationInput = document.getElementById('warranty-duration');
        const editDurationInput = document.getElementById('warranty-duration-edit');
        
        // Fill date inputs
        if (mainDateInput) mainDateInput.value = date;
        if (editDateInput) editDateInput.value = date;
        
        // Fill duration inputs if found
        if (duration) {
            if (mainDurationInput) mainDurationInput.value = duration;
            if (editDurationInput) editDurationInput.value = duration;
            return `Found and filled date (${date}) and warranty duration (${duration} months)`;
        }
        
        return `Found and filled date: ${date}`;
    } finally {
        if (hint) {
            hint.textContent = 'Upload a photo or scan of your receipt and we\'ll try to extract the purchase date.';
        }
    }
}