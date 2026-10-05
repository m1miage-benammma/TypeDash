import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/** Preserve the typing component when only its localized URL changes. */
@Injectable()
export class TypingRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return super.shouldReuseRoute(future, current)
      || (future.data['pageId'] === 'typingTest' && current.data['pageId'] === 'typingTest'
        && !!future.data['language'] && !!current.data['language']);
  }
}
