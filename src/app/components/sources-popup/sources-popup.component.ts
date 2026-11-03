import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ExternalLink } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Modal popup displaying scientific data sources, licenses, and methodology.
 */
@Component({
  selector: 'app-sources-popup',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './sources-popup.component.html',
  styleUrl: './sources-popup.component.scss'
})
export class SourcesPopupComponent {
  readonly i18n = inject(I18nService);
  readonly externalLinkIcon = ExternalLink;
}
