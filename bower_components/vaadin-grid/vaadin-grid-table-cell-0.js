
  (function() {

    /**
     * @polymerBehavior vaadinGridTableCellBehavior
     */
    var vaadinGridTableCellBehavior = {
      properties: {
        column: Object,
        expanded: Boolean,
        flexGrow: Number,
        focused: {
          type: Boolean,
          reflectToAttribute: true
        },
        frozen: {
          type: Boolean,
          reflectToAttribute: true
        },
        lastFrozen: {
          type: Boolean,
          reflectToAttribute: true
        },
        hidden: {
          type: Boolean,
          reflectToAttribute: true
        },
        instance: Object,
        index: Number,
        item: Object,
        selected: Boolean,
        template: Object,
        target: Object,
        width: String,
        order: Number,
        reorderStatus: {
          type: String,
          reflectToAttribute: true
        },

        _childColumns: Array,

        _cellContent: Object,
        _insertionPoint: Object,
        _templatizer: Object
      },

      observers: ['_columnChanged(column)',
        '_cellAttached(column, isAttached)',
        '_expandedChanged(expanded, instance)',
        '_flexGrowChanged(flexGrow)',
        '_indexChanged(index, instance)',
        '_itemChanged(item, instance)',
        '_instanceChanged(instance, target)',
        '_selectedChanged(selected, instance)',
        '_toggleContent(isAttached, _cellContent, _insertionPoint)',
        '_toggleInstance(isAttached, _templatizer, instance)',
        '_widthChanged(width)',
        '_orderChanged(order)',
        '_visibleChildColumnsChanged(_visibleChildColumns)',
        '_childColumnsChanged(_childColumns)'
      ],

      created: function() {
        this.classList.add('vaadin-grid-cell');
      },

      _columnChanged: function(column) {
        this.flexGrow = column.flexGrow;
        this.frozen = column.frozen;
        this.lastFrozen = column._lastFrozen;
        this.headerTemplate = column.headerTemplate;
        this.footerTemplate = column.footerTemplate;
        this.template = column.template;
        this.width = column.width;
        this.hidden = column.hidden;
        this.resizable = column.resizable;
        this._childColumns = column._childColumns;
        this.order = column._order;

        // Assigning undefined to element.colSpan will set colSpan attribute to 0
        if (column.colSpan) {
          this.setAttribute('colspan', column.colSpan);
        }

        this.listen(column, 'property-changed', '_columnPropChanged');
      },

      _cellAttached: function(column, isAttached) {
        // Cells get detached when the column tree changes and new cells are created.
        // Also, cells get detached and attached during row reordering after scrolling.
        if (isAttached) {
          this.listen(column, 'property-changed', '_columnPropChanged');
        } else {
          this.unlisten(column, 'property-changed', '_columnPropChanged');
        }
      },

      _columnPropChanged: function(e) {
        if (e.target == this.column) {
          if (e.detail.path === 'colSpan') {
            this.setAttribute('colspan', e.detail.value);
          } else {
            this[e.detail.path] = e.detail.value;
          }
        }
      },

      _expandedChanged: function(expanded, instance) {
        instance.__expanded__ = expanded;
        instance.expanded = expanded;
      },

      _flexGrowChanged: function(flexGrow) {
        this.style.flexGrow = flexGrow;
      },

      _indexChanged: function(index, instance) {
        instance.index = index;
      },

      _itemChanged: function(item, instance) {
        instance.item = item;
      },

      _selectedChanged: function(selected, instance) {
        instance.__selected__ = selected;
        instance.selected = selected;
      },

      _childColumnsChanged: function(childColumns) {
        this.setAttribute('colspan', childColumns.length);
      },

      _toggleContent: function(isAttached, cellContent, insertionPoint) {
        if (isAttached) {
          if (Polymer.dom(cellContent).parentNode !== this.target) {
            Polymer.dom(this.target).appendChild(cellContent);
          }
          Polymer.dom(this).appendChild(insertionPoint);
        } else {
          this.async(function() {
            if (!this.isAttached && Polymer.dom(cellContent).parentNode === this.target) {
              Polymer.dom(this.target).removeChild(cellContent);
            }
          });
        }
      },

      _toggleInstance: function(isAttached, templatizer, instance) {
        if (isAttached) {
          templatizer.addInstance(instance);
        } else {
          templatizer.removeInstance(instance);
        }
      },

      _widthChanged: function(width) {
        this.style.width = width;
      },

      _orderChanged: function(order) {
        this.style.order = order;
      },

      _templateChanged: function(template) {
        this.instance = template.templatizer.createInstance();
        this._templatizer = template.templatizer;
      },

      _instanceChanged: function(instance, target) {
        this.style.height = '';

        this._cellContent = document.createElement('vaadin-grid-cell-content');

        var contentId = vaadin.elements.grid._contentIndex = vaadin.elements.grid._contentIndex + 1 || 0;
        var id = 'vaadin-grid-cell-content-' + contentId;
        this._cellContent.setAttribute('id', id);

        Polymer.dom(this._cellContent).appendChild(this.instance.root);

        this._insertionPoint = document.createElement('content');
        this._insertionPoint.setAttribute('select', '#' + id);
      },
    };

    Polymer({
      is: 'vaadin-grid-table-cell',

      extends: 'td',

      behaviors: [
        vaadinGridTableCellBehavior,
        vaadin.elements.grid.CellClickBehavior
      ],

      observers: ['_templateChanged(template)'],

      _cellClick: function(e) {
        if (!e.defaultPrevented) {
          this.fire('cell-activate', {
            model: this.instance
          });
        }
      }
    });

    Polymer({
      is: 'vaadin-grid-table-header-cell',

      extends: 'th',

      properties: {
        headerTemplate: Object,

        resizable: Boolean,

        columnResizing: {
          type: Boolean,
          reflectToAttribute: true
        }
      },

      behaviors: [
        vaadinGridTableCellBehavior,
        vaadin.elements.grid.CellClickBehavior
      ],

      observers: [
        '_headerTemplateChanged(headerTemplate, isAttached)',
        '_resizableChanged(resizable)'
      ],

      listeners: {
        'mousedown': '_cancelMouseDownOnResize',
        'mousemove': '_enableDrag',
        'mouseout': '_disableDrag',
        'touchstart': '_onTouchStart',
        'touchmove': '_onTouchMove',
        'touchend': '_onTouchEnd',
        'contextmenu': '_onContextMenu'
      },

      _onContextMenu: function(e) {
        if (this._reorderGhost) {
          e.preventDefault();
        }
      },

      _onTouchStart: function(e) {
        if (e.target !== this._resizeHandle && this.target.columnReorderingAllowed) {
          this._startReorderTimeout = setTimeout(this._startReorder.bind(this, e), 100);
        }
      },

      _startReorder: function(e) {
        this._reorderGhost = this._getGhost();
        this._reorderGhost.style.visibility = 'visible';

        var dragStart = new CustomEvent('dragstart', {bubbles: true});
        this._cellContent.dispatchEvent(dragStart);

        this._reorderXY = {
          x: e.touches[0].clientX - this.getBoundingClientRect().left,
          y: e.touches[0].clientY - this.getBoundingClientRect().top
        };

        this._updateGhostPosition(e.touches[0].clientX, e.touches[0].clientY);
      },

      _onTouchMove: function(e) {
        if (this._reorderGhost) {
          e.preventDefault();
          var dragOver = new CustomEvent('dragover', {bubbles: true});
          dragOver.clientX = e.touches[0].clientX;
          dragOver.clientY = e.touches[0].clientY;

          var target = this._contentFromPoint(dragOver.clientX, dragOver.clientY);
          if (target) {
            target.dispatchEvent(dragOver);
          }
          this._updateGhostPosition(e.touches[0].clientX, e.touches[0].clientY);
        } else {
          clearTimeout(this._startReorderTimeout);
        }
      },

      _updateGhostPosition: function(eventClientX, eventClientY) {
        // This is where we want to position the ghost
        var targetLeft = eventClientX - this._reorderXY.x;
        var targetTop = eventClientY - this._reorderXY.y - 50;

        // Current position
        var _left = parseInt(this._reorderGhost.style.left || 0);
        var _top = parseInt(this._reorderGhost.style.top || 0);

        // Reposition the ghost
        var ghostRect = this._reorderGhost.getBoundingClientRect();
        this._reorderGhost.style.left = _left - (ghostRect.left - targetLeft) + 'px';
        this._reorderGhost.style.top = _top - (ghostRect.top - targetTop) + 'px';
      },

      _onTouchEnd: function(e) {
        clearTimeout(this._startReorderTimeout);
        if (this._reorderGhost) {
          e.preventDefault();
          var event = new CustomEvent('dragend', {bubbles: true});
          this.dispatchEvent(event);
          this._reorderGhost.style.visibility = 'hidden';
          this._reorderGhost = null;
        }
      },

      _contentFromPoint: function(x, y) {
        if (Polymer.Settings.useShadow) {
          var scroller = this.target.$.scroller;
          scroller.toggleAttribute('no-content-pointer-events', true);
          var cell = scroller.root.elementFromPoint(x, y);
          scroller.toggleAttribute('no-content-pointer-events', false);
          if (cell && cell.getContentChildren) {
            return cell.getContentChildren('content')[0];
          }
        } else {
          return document.elementFromPoint(x, y);
        }
      },

      _getGhost: function() {
        var ghost = this.target.$.scroller.$.reorderghost;
        ghost.innerText = this._cellContent.innerText;
        var style = window.getComputedStyle(this._cellContent);
        ['boxSizing', 'display', 'width', 'height', 'background', 'alignItems', 'padding', 'border', 'flex-direction', 'overflow']
        .forEach(function(propertyName) {
          ghost.style[propertyName] = style[propertyName];
        }, this);
        return ghost;
      },

      _enableDrag: function() {
        // Text inside draggable grid cells can't be selected. Thus we need to
        // check the global selection state here to avoid a cell becoming
        // draggable while text is being selected.
        this._cellContent.draggable = this.target.columnReorderingAllowed && !window.getSelection().toString();
      },

      _disableDrag: function() {
        this._cellContent.draggable = false;
      },

      _cancelMouseDownOnResize: function(e) {
        if (e.target === this._resizeHandle) {
          e.preventDefault();
        }
      },

      _resizableChanged: function(resizable) {
        if (resizable) {
          this._resizeHandle = document.createElement('div');
          this._resizeHandle.classList.add('vaadin-grid-column-resize-handle');
          this.listen(this._resizeHandle, 'track', '_onTrack');
          Polymer.dom(this).appendChild(this._resizeHandle);
        } else if (this._resizeHandle) {
          this.unlisten(this._resizeHandle, 'track', '_onTrack');
          Polymer.dom(this).removeChild(this._resizeHandle);
        }
      },

      _onTrack: function(e) {
        this.columnResizing = true;

        // Get the target column to resize
        var column = this.column;
        if (column.localName === 'vaadin-grid-column-group') {
          column = column._childColumns.slice(0)
          .sort(function(a, b) {
            return a._order - b._order;
          })
          .filter(function(column) {
            return !column.hidden;
          }).pop();
        }
        var targetCell = this._getHeaderCellByColumn(column);

        // Resize the target column
        if (targetCell.offsetWidth) {
          var style = window.getComputedStyle(targetCell._cellContent);
          var minWidth = 10 + parseInt(style.paddingLeft) + parseInt(style.paddingRight);
          column.width = Math.max(minWidth, targetCell.offsetWidth + e.detail.x - targetCell.getBoundingClientRect().right) + 'px';
          column.flexGrow = 0;
        }

        // Fix width and flex-grow for all preceding columns
        var thead = this.parentElement.parentElement;
        Polymer.dom(thead).querySelectorAll('tr:last-child th')
        .sort(function(a, b) {
          return a.column._order - b.column._order;
        })
        .forEach(function(cell, index, array) {
          if (index < array.indexOf(targetCell)) {
            cell.column.width = cell.offsetWidth + 'px';
            cell.column.flexGrow = 0;
          }
        });

        if (this.columnResizing && e.detail.state === 'end') {
          this.columnResizing = false;
        }

        this.fire('column-resizing');
      },

      _getHeaderCellByColumn: function(column) {
        var thead = this.parentElement.parentElement;
        return Polymer.dom(thead).querySelectorAll('tr:last-child th').filter(function(cell) {
          return cell.column === column;
        })[0];
      },

      _headerTemplateChanged: function(headerTemplate, isAttached) {
        if (headerTemplate !== null && (this._isColumnRow || this.column.localName === 'vaadin-grid-column-group')) {
          this._isEmpty = false;
          this.instance = this.instance || headerTemplate.templatizer.createInstance();
          this._templatizer = headerTemplate.templatizer;
        } else {
          this._isEmpty = true;
          this.instance = this.instance || {root: document.createElement('div')};
        }

        // Safari 9 doesn't bubble events while not attached to the DOM. #552
        if (isAttached) {
          this.fire('cell-empty-changed');
        }
      }
    });

    Polymer({
      is: 'vaadin-grid-table-footer-cell',

      extends: 'td',

      properties: {
        footerTemplate: Object
      },

      behaviors: [
        vaadinGridTableCellBehavior,
        vaadin.elements.grid.CellClickBehavior
      ],

      observers: ['_footerTemplateChanged(footerTemplate, isAttached)'],

      _footerTemplateChanged: function(footerTemplate, isAttached) {
        if (footerTemplate !== null && (this._isColumnRow || this.column.localName === 'vaadin-grid-column-group')) {
          this._isEmpty = false;
          this.instance = this.instance || footerTemplate.templatizer.createInstance();
          this._templatizer = footerTemplate.templatizer;
        } else {
          this._isEmpty = true;
          this.instance = this.instance || {root: document.createElement('div')};
        }

        // Safari 9 doesn't bubble events while not attached to the DOM. #552
        if (isAttached) {
          this.fire('cell-empty-changed');
        }
      }
    });

    Polymer({
      is: 'vaadin-grid-sizer-cell',

      behaviors: [vaadinGridTableCellBehavior]
    });
  })();
