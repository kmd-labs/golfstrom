import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ExternalLink, ArrowRight } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { AboutService, PopupService } from '@kmd/design-system';

/**
 * Modal popup displaying scientific data sources, licenses, methodology,
 * and KMD Labs project attribution, formatted similarly to el-nino.
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
  private readonly popup = inject(PopupService);
  private readonly about = inject(AboutService);

  readonly externalLinkIcon = ExternalLink;
  readonly arrowIcon = ArrowRight;

  openAbout() {
    this.popup.close();
    this.about.open({ lang: this.i18n.lang() });
  }
}
