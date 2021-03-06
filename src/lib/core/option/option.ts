/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
  Inject,
  Optional,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {ENTER, SPACE} from '../keyboard/keycodes';
import {coerceBooleanProperty} from '@angular/cdk/coercion';
import {MATERIAL_COMPATIBILITY_MODE} from '../../core/compatibility/compatibility';
import {MdOptgroup} from './optgroup';

/**
 * Option IDs need to be unique across components, so this counter exists outside of
 * the component definition.
 */
let _uniqueIdCounter = 0;

/** Event object emitted by MdOption when selected or deselected. */
export class MdOptionSelectionChange {
  constructor(public source: MdOption, public isUserInput = false) { }
}

/**
 * Single option inside of a `<md-select>` element.
 */
@Component({
  moduleId: module.id,
  selector: 'md-option, mat-option',
  host: {
    'role': 'option',
    '[attr.tabindex]': '_getTabIndex()',
    '[class.mat-selected]': 'selected',
    '[class.mat-option-multiple]': 'multiple',
    '[class.mat-active]': 'active',
    '[id]': 'id',
    '[attr.aria-selected]': 'selected.toString()',
    '[attr.aria-disabled]': 'disabled.toString()',
    '[class.mat-option-disabled]': 'disabled',
    '(click)': '_selectViaInteraction()',
    '(keydown)': '_handleKeydown($event)',
    'class': 'mat-option',
  },
  templateUrl: 'option.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MdOption {
  private _selected: boolean = false;
  private _active: boolean = false;
  private _multiple: boolean = false;
  private _disableRipple: boolean = false;

  /** Whether the option is disabled.  */
  private _disabled: boolean = false;

  private _id: string = `md-option-${_uniqueIdCounter++}`;

  /** Whether the wrapping component is in multiple selection mode. */
  get multiple() { return this._multiple; }
  set multiple(value: boolean) {
    if (value !== this._multiple) {
      this._multiple = value;
      this._changeDetectorRef.markForCheck();
    }
  }

  /** The unique ID of the option. */
  get id() { return this._id; }

  /** Whether or not the option is currently selected. */
  get selected(): boolean { return this._selected; }

  /** The form value of the option. */
  @Input() value: any;

  /** Whether the option is disabled. */
  @Input()
  get disabled() { return (this.group && this.group.disabled) || this._disabled; }
  set disabled(value: any) { this._disabled = coerceBooleanProperty(value); }

  /** Whether ripples for the option are disabled. */
  get disableRipple() { return this._disableRipple; }
  set disableRipple(value: boolean) {
    this._disableRipple = value;
    this._changeDetectorRef.markForCheck();
  }

  /** Event emitted when the option is selected or deselected. */
  @Output() onSelectionChange = new EventEmitter<MdOptionSelectionChange>();

  constructor(
    private _element: ElementRef,
    private _changeDetectorRef: ChangeDetectorRef,
    @Optional() public readonly group: MdOptgroup,
    @Optional() @Inject(MATERIAL_COMPATIBILITY_MODE) public _isCompatibilityMode: boolean) {}

  /**
   * Whether or not the option is currently active and ready to be selected.
   * An active option displays styles as if it is focused, but the
   * focus is actually retained somewhere else. This comes in handy
   * for components like autocomplete where focus must remain on the input.
   */
  get active(): boolean {
    return this._active;
  }

  /**
   * The displayed value of the option. It is necessary to show the selected option in the
   * select's trigger.
   */
  get viewValue(): string {
    // TODO(kara): Add input property alternative for node envs.
    return (this._getHostElement().textContent || '').trim();
  }

  /** Selects the option. */
  select(): void {
    this._selected = true;
    this._changeDetectorRef.markForCheck();
    this._emitSelectionChangeEvent();
  }

  /** Deselects the option. */
  deselect(): void {
    this._selected = false;
    this._changeDetectorRef.markForCheck();
    this._emitSelectionChangeEvent();
  }

  /** Sets focus onto this option. */
  focus(): void {
    const element = this._getHostElement();

    if ('focus' in element) {
      element.focus();
    }
  }

  /**
   * This method sets display styles on the option to make it appear
   * active. This is used by the ActiveDescendantKeyManager so key
   * events will display the proper options as active on arrow key events.
   */
  setActiveStyles(): void {
    if (!this._active) {
      this._active = true;
      this._changeDetectorRef.markForCheck();
    }
  }

  /**
   * This method removes display styles on the option that made it appear
   * active. This is used by the ActiveDescendantKeyManager so key
   * events will display the proper options as active on arrow key events.
   */
  setInactiveStyles(): void {
    if (this._active) {
      this._active = false;
      this._changeDetectorRef.markForCheck();
    }
  }

  /** Ensures the option is selected when activated from the keyboard. */
  _handleKeydown(event: KeyboardEvent): void {
    if (event.keyCode === ENTER || event.keyCode === SPACE) {
      this._selectViaInteraction();

      // Prevent the page from scrolling down and form submits.
      event.preventDefault();
    }
  }

  /**
   * Selects the option while indicating the selection came from the user. Used to
   * determine if the select's view -> model callback should be invoked.
   */
  _selectViaInteraction(): void {
    if (!this.disabled) {
      this._selected = this.multiple ? !this._selected : true;
      this._changeDetectorRef.markForCheck();
      this._emitSelectionChangeEvent(true);
    }
  }

  /** Returns the correct tabindex for the option depending on disabled state. */
  _getTabIndex(): string {
    return this.disabled ? '-1' : '0';
  }

  /** Fetches the host DOM element. */
  _getHostElement(): HTMLElement {
    return this._element.nativeElement;
  }

  /** Emits the selection change event. */
  private _emitSelectionChangeEvent(isUserInput = false): void {
    this.onSelectionChange.emit(new MdOptionSelectionChange(this, isUserInput));
  }

}
