import { Pipe, PipeTransform } from '@angular/core';
import { Observable } from 'rxjs';
import { ContentFileService } from '../services/content-file.service';

/**
 * Turns a content file uid into something an `<img>` can load.
 *
 * The file endpoint authenticates a bearer token, which the browser never
 * attaches to an element-initiated request — an `<img src>` pointing straight
 * at it comes back 401 and renders as a broken image. The bytes go through
 * HttpClient instead, where the auth interceptor runs, and reach the DOM as a
 * blob URL.
 *
 * Pure, and the service caches per uid, so a grid of cards sharing a picture
 * issues one request. Use with the async pipe:
 *
 *     <img [src]="uid | contentFileUrl | async" />
 */
@Pipe({ name: 'contentFileUrl', standalone: false })
export class ContentFileUrlPipe implements PipeTransform {
  constructor(private files: ContentFileService) {}

  transform(uid?: string | null): Observable<string> | null {
    return uid ? this.files.objectUrl(uid) : null;
  }
}
