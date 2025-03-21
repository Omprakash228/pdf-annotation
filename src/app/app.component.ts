import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PdfViewerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'pdf-annotation';

  @ViewChild(PdfViewerComponent) pdfViewer!: PdfViewerComponent;

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const arrayBuffer = fileReader.result;
        const pdfUrl = URL.createObjectURL(file);
        this.pdfViewer.loadPDF(pdfUrl);
      };
      fileReader.readAsArrayBuffer(file);
    }
  }
}
