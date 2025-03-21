import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as pdfjsLib from 'pdfjs-dist';
import SignaturePad from 'signature_pad';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.js';

@Component({
  selector: 'app-pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./pdf-viewer.component.scss'],
  standalone: true,
})
export class PdfViewerComponent implements OnInit {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef;
  @ViewChild('textInput') textInput!: ElementRef;

  pdfDoc: any = null;
  pageNum = 1;
  pageRendering = false;
  pageNumPending: number | null = null;
  scale = 1.0;
  totalPages = 0;
  currentPageCanvas: any = null;
  signaturePad: SignaturePad | null = null;
  isSignatureMode = false;
  isTextMode = false;
  isDraggingSignature = false;
  signatureImage: any = null;
  signaturePosition = { x: 0, y: 0 };
  textPosition = { x: 0, y: 0 };
  textContent = '';
  // Track event handlers for proper cleanup
  _mouseDownHandler: any = null;
  _mouseMoveHandler: any = null;
  _mouseUpHandler: any = null;
  _currentDraggingIndex: number = -1;
  _dragOffsetX: number = 0;
  _dragOffsetY: number = 0;
  addedItems: Array<{
    type: 'signature' | 'text';
    position: { x: number; y: number };
    content?: string;
    image?: any;
    pageNum: number;
  }> = [];

  constructor() {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initSignaturePad();
  }

  initSignaturePad(): void {
    this.signaturePad = new SignaturePad(this.signatureCanvas.nativeElement, {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      penColor: 'black',
    });
  }

  loadPDF(url: string): void {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/pdf.worker.mjs';
    pdfjsLib.getDocument(url).promise.then((pdfDoc_: any) => {
      this.pdfDoc = pdfDoc_;
      this.totalPages = pdfDoc_.numPages;
      this.renderPage(this.pageNum);
    });
  }

  renderPage(num: number): void {
    this.pageRendering = true;
    this.pdfDoc.getPage(num).then((page: any) => {
      const viewport = page.getViewport({ scale: this.scale });

      // Clear previous canvas elements
      this.canvasContainer.nativeElement.innerHTML = '';

      // Create canvas for PDF page
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page';
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      this.canvasContainer.nativeElement.appendChild(canvas);
      this.currentPageCanvas = canvas;

      // Render PDF page into canvas context
      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);

      // Re-render any added items after the page loads
      renderTask.promise.then(() => {
        this.pageRendering = false;
        this.renderAddedItems();

        if (this.pageNumPending !== null) {
          this.renderPage(this.pageNumPending);
          this.pageNumPending = null;
        }
      });
    });
  }

  // Render all signatures and text added to the current page
  renderAddedItems(): void {
    const canvas = this.currentPageCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Filter items for current page
    const itemsOnCurrentPage = this.addedItems.filter(
      (item) => item.pageNum === this.pageNum
    );

    // Render each item
    itemsOnCurrentPage.forEach((item) => {
      if (item.type === 'signature' && item.image) {
        try {
          ctx.drawImage(item.image, item.position.x, item.position.y);
          console.log('Drew signature at:', item.position.x, item.position.y);
        } catch (err) {
          console.error('Error drawing signature:', err);
        }
      } else if (item.type === 'text' && item.content) {
        ctx.font = '16px Arial';
        ctx.fillStyle = 'black'; // Ensure text is visible
        ctx.fillText(item.content, item.position.x, item.position.y);
        console.log(
          'Drew text:',
          item.content,
          'at:',
          item.position.x,
          item.position.y
        );
      }
    });

    console.log('Items on current page:', itemsOnCurrentPage.length);
  }

  queueRenderPage(num: number): void {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.renderPage(num);
    }
  }

  prevPage(): void {
    if (this.pageNum <= 1) {
      return;
    }
    this.pageNum--;
    this.queueRenderPage(this.pageNum);
  }

  nextPage(): void {
    if (this.pageNum >= this.totalPages) {
      return;
    }
    this.pageNum++;
    this.queueRenderPage(this.pageNum);
  }

  zoomIn(): void {
    this.scale += 0.25;
    this.queueRenderPage(this.pageNum);
  }

  zoomOut(): void {
    if (this.scale <= 0.5) {
      return;
    }
    this.scale -= 0.25;
    this.queueRenderPage(this.pageNum);
  }

  // Toggle signature drawing mode
  toggleSignatureMode(): void {
    this.isSignatureMode = !this.isSignatureMode;
    this.isTextMode = false;

    if (this.isSignatureMode) {
      // Show the signature pad
      this.signatureCanvas.nativeElement.style.display = 'block';
    } else {
      // Hide the signature pad
      this.signatureCanvas.nativeElement.style.display = 'none';
    }
  }

  // Clear the signature pad
  clearSignature(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
  }

  // Save signature from pad
  saveSignature(): void {
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      // Convert to image
      const dataURL = this.signaturePad.toDataURL('image/png');

      // Create an image element to handle dragging
      const img = new Image();
      img.src = dataURL;

      img.onload = () => {
        this.signatureImage = img;
        this.signatureCanvas.nativeElement.style.display = 'none';
        this.isSignatureMode = false;

        // Center signature on page initially
        this.signaturePosition = {
          x: (this.currentPageCanvas.width - img.width) / 2,
          y: (this.currentPageCanvas.height - img.height) / 2,
        };

        // Add the signature directly to the items array
        this.addedItems.push({
          type: 'signature',
          position: { ...this.signaturePosition },
          image: this.signatureImage,
          pageNum: this.pageNum,
        });

        // Re-render the page with the signature
        // this.renderPage(this.pageNum);

        // Also setup drag functionality for repositioning
        this.setupSignaturePlacement();

        // Log for debugging
        console.log('Signature added at:', this.signaturePosition);
        console.log('Total annotations:', this.addedItems.length);
      };
    }
  }

  // Set up event handlers for placing the signature
  setupSignaturePlacement(): void {
    const canvas = this.currentPageCanvas;
    if (!canvas) {
      console.error('Canvas not found for signature placement');
      return;
    }

    // Clean up any previous event listeners
    if (this._mouseMoveHandler) {
      canvas.removeEventListener('mousemove', this._mouseMoveHandler);
      this._mouseMoveHandler = null;
    }
    if (this._mouseDownHandler) {
      canvas.removeEventListener('mousedown', this._mouseDownHandler);
      this._mouseDownHandler = null;
    }
    if (this._mouseUpHandler) {
      document.removeEventListener('mouseup', this._mouseUpHandler);
      this._mouseUpHandler = null;
    }

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      console.log('Mouse down at:', x, y);

      // Find signatures on current page
      const signaturesOnPage = this.addedItems.filter(
        (item) => item.type === 'signature' && item.pageNum === this.pageNum
      );

      console.log('Signatures on page:', signaturesOnPage.length);

      // Check each signature to see if it was clicked
      for (let i = 0; i < signaturesOnPage.length; i++) {
        const sig = signaturesOnPage[i];
        if (!sig.image) continue;

        const sigWidth = sig.image.width;
        const sigHeight = sig.image.height;

        console.log(
          'Checking signature:',
          i,
          'at',
          sig.position.x,
          sig.position.y,
          'width:',
          sigWidth,
          'height:',
          sigHeight
        );

        if (
          x >= sig.position.x &&
          x <= sig.position.x + sigWidth &&
          y >= sig.position.y &&
          y <= sig.position.y + sigHeight
        ) {
          console.log('Found clicked signature:', i);
          this.isDraggingSignature = true;
          this._currentDraggingIndex = this.addedItems.indexOf(sig);
          // Store offset from corner to click point for smoother dragging
          this._dragOffsetX = x - sig.position.x;
          this._dragOffsetY = y - sig.position.y;
          break;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.isDraggingSignature && this._currentDraggingIndex >= 0) {
        const rect = canvas.getBoundingClientRect();
        const sig = this.addedItems[this._currentDraggingIndex];

        if (sig) {
          // Update position accounting for the initial click offset
          const newX = e.clientX - rect.left - this._dragOffsetX;
          const newY = e.clientY - rect.top - this._dragOffsetY;

          console.log('Moving signature to:', newX, newY);

          // Update the position in the items array
          this.addedItems[this._currentDraggingIndex].position = {
            x: newX,
            y: newY,
          };

          // Re-render the page with the updated signature position
          this.renderPage(this.pageNum);
        }
      }
    };

    const onMouseUp = () => {
      if (this.isDraggingSignature) {
        console.log('Finished moving signature');
        this.isDraggingSignature = false;
        this._currentDraggingIndex = -1;
      }
    };

    // Store handlers for cleanup
    this._mouseDownHandler = onMouseDown;
    this._mouseMoveHandler = onMouseMove;
    this._mouseUpHandler = onMouseUp;

    // Add event listeners
    console.log('Setting up signature placement handlers');
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Toggle text input mode
  toggleTextMode(): void {
    this.isTextMode = !this.isTextMode;
    this.isSignatureMode = false;

    if (this.isTextMode) {
      this.textInput.nativeElement.style.display = 'block';
    } else {
      this.textInput.nativeElement.style.display = 'none';
    }
  }

  // Add text to the PDF
  addText(): void {
    if (!this.textContent || !this.isTextMode) return;

    const canvas = this.currentPageCanvas;

    const placeText = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.textPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Add to items array
      this.addedItems.push({
        type: 'text',
        position: { ...this.textPosition },
        content: this.textContent,
        pageNum: this.pageNum,
      });

      // Re-render with the added text
      this.renderPage(this.pageNum);

      // Remove click handler after placing text
      canvas.removeEventListener('click', placeText);
      this.isTextMode = false;
      this.textInput.nativeElement.style.display = 'none';
      this.textContent = '';
    };

    canvas.addEventListener('click', placeText);
  }

  // Save the PDF with annotations
  async savePDF(): Promise<void> {
    // try {
    //   // First, ensure we have the PDF-LIB library
    //   const pdfLib = await import('pdf-lib');

    //   // Create array to hold each page's canvas
    //   const canvases: HTMLCanvasElement[] = [];

    //   // Store current page to restore later
    //   const currentPageBackup = this.pageNum;

    //   // Render each page with annotations to a canvas
    //   for (let i = 1; i <= this.totalPages; i++) {
    //     // Set current page
    //     this.pageNum = i;

    //     // Wait for page to render with its annotations
    //     await new Promise<void>((resolve) => {
    //       this.pdfDoc.getPage(i).then((page: any) => {
    //         const viewport = page.getViewport({ scale: this.scale });

    //         // Create a new canvas for this page
    //         const canvas = document.createElement('canvas');
    //         canvas.height = viewport.height;
    //         canvas.width = viewport.width;

    //         const ctx = canvas.getContext('2d');

    //         const renderContext = {
    //           canvasContext: ctx,
    //           viewport: viewport,
    //         };

    //         // Render PDF page into canvas context
    //         const renderTask = page.render(renderContext);

    //         renderTask.promise.then(() => {
    //           // After page is rendered, add its annotations
    //           const itemsOnPage = this.addedItems.filter(
    //             (item) => item.pageNum === i
    //           );

    //           itemsOnPage.forEach((item) => {
    //             if (item.type === 'signature' && item.image) {
    //               ctx?.drawImage(item.image, item.position.x, item.position.y);
    //             } else if (item.type === 'text' && item.content) {
    //               if (ctx) {
    //                 ctx.font = '16px Arial';
    //                 ctx.fillText(
    //                   item.content,
    //                   item.position.x,
    //                   item.position.y
    //                 );
    //               }
    //             }
    //           });

    //           // Store this canvas
    //           canvases.push(canvas);
    //           resolve();
    //         });
    //       });
    //     });
    //   }

    //   // Restore the original page
    //   this.pageNum = currentPageBackup;
    //   this.renderPage(this.pageNum);

    //   // Create a new PDF document
    //   const pdfDoc = await pdfLib.PDFDocument.create();

    //   // Add each annotated page to the new document
    //   for (const canvas of canvases) {
    //     // Convert canvas to PNG
    //     const pngData = canvas.toDataURL('image/png').split(',')[1];
    //     const pngImage = await pdfDoc.embedPng(pngData);

    //     // Add a page with the same dimensions as our canvas
    //     const page = pdfDoc.addPage([canvas.width, canvas.height]);

    //     // Draw the PNG on the page
    //     page.drawImage(pngImage, {
    //       x: 0,
    //       y: 0,
    //       width: canvas.width,
    //       height: canvas.height,
    //     });
    //   }

    //   // Serialize the PDFDocument to bytes
    //   const pdfBytes = await pdfDoc.save();

    //   // Create a Blob from the bytes
    //   const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    //   // Create a download link and trigger it
    //   const link = document.createElement('a');
    //   link.href = URL.createObjectURL(blob);
    //   link.download = 'annotated-document.pdf';
    //   link.click();
    // } catch (error) {
    //   console.error('Error saving PDF:', error);
    //   alert('Error saving PDF. Please check console for details.');
    // }
  }
}
