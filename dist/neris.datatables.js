/**
 * 数据表格组件，使用前请阅读组件API文档。
 * 旧的分页表格组件（neris.grid.js）新功能已停止更新，使用上下分页等新功能请使用此组件。
 * 该组件依赖第三方插件 jQuery、jquery.dataTables.js、dataTables.bootstrap.js。
 * 
 * Copyright ® 中国证监会中央监管信息平台版权所有
 * 
 * Author: https://github.com/gongph
 * Version: 1.0.0
 * Date: 2017-04-24 10:37
 */
( function ( factory ) {
	"use strict";
	
	if (typeof jQuery === "undefined" ) {
		throw new Error("neris.datatables.js required jQuery!");
	}
	
	typeof exports === "object" && typeof module === "object" && typeof module.exports === "object" ? module.exports = factory() :
	typeof define === "function" && define.amd ? define( factory ) : factory()
	
})( function () {
	"use strict";
	
	var	_tableId,            // 表格Id字符串，格式： `#example`
		_containerId,        // 组件容器 id 选择器。例如： `#example_wrapper`
		_tableObj,           // 表格初始化返回的对象
		_allcheckCache = [], // 存储每页全选按钮的勾选状态
		_selectedCache = [], // 存储每页被勾选的行 Id 属性值
		_settings,           // 全局配置选项
		
		/**
		 * 构造函数
		 * @param {Object} options 参数
		 */
		NerisDataTables = function ( options ) {
			this.each( function () {
				_tableId = '#' + this.id; // 把 表格 id 赋值给变量 `_tableId`
				_containerId = _tableId +"_wrapper";
				
				// 这里判断是否有参数，没有参数抛出异常
				if ( !options ) {
					throw new Error ( "'$(" + _tableId + "').nerisDataTables({...}) parameter cannot be null！" );
				}
				
				// `checking` 和 `rowId` 选项同时启用
				if ( options.checking && !options.rowId ) {
					throw new Error ("when the `checking` option is enabled, you must set the `rowId` option at the same time!");
				}
				
				_settings = $.extend( true, {}, _options, options ); // 把用户设置的参数赋值给默认参数
				
				// 是否显示索引列
				if ( _settings.indexing ) {
					_settings.columns.unshift( _fnAddIndexing() );
				}
				
				// 如果设置显示勾选框，则增加勾选列到 `_settings.columns` 数组中。
				if ( _settings.checking ) {
					_settings.columns.unshift( _fnAddChecking() );
				}
				
				// 如果启用滚动条，设置 `nowrap` 样式类
				if ( _settings.scrollX ) {
					$( _tableId ).addClass("nowrap");
				}
				
				// 初始化表格
				_fnInitDataTables();
			});
			
			return {
				getSelected: function () {
					return _fnGetSelected();
				},
				setPage: function ( set ) {
					return _fnSetPage( set );
				}
			}
		},
		/**
		 * 国际化
		 */
		_language = {
			info: "当前第 _PAGE_ 页 / 共 _PAGES_ 页",			// 分页数据
			infoEmpty: "当前第 0 页 / 共 0 页",					// 分页数据为空时显示
			lengthMenu: "每页显示  _MENU_ 条",					// 每页显示
			search: "查询: ",								// 查询
			paginate: {										// 分页
		        first: "首页",
		        last: "末页",
		        next: "下一页",
		        previous: "上一页"
		    },
		    "processing": "加载中...",						// 处理提示
		    "loadingRecords": "加载中...",					// 加载动画
		    "zeroRecords": "没有符合条件的数据！",				// 表格没有数据提示
		},
		/**
		 * 默认选项
		 */
		_options = {
			indexing: false,								// 是否显示序列
			checking: false,								// 是否开启勾选功能，默认不开启
			language: _language, 							// 国际化
			processing: false, 								// 是否开启 Loading 动画，默认不开启
			serverSide: true,  								// 是否开启服务端，默认开启
			paging: true, 									// 是否开启分页功能，默认开启
			pageLength: 5,									// 每页显示条数，该参数当设置 `paging: true` 时生效
			pageShow: "bottom",								// 指定分页的位置，默认在表格下方。可选值：`top`、`bottom`、`all`
			scrollX: false,									// 是否开启横向滚动条功能，默认不开启
			ordering: false,								// 是否开启排序功能，默认不开启
			rowId: "",										// 指定行 id。最终给每行的 tr 生成一个 id 属性，属性值就是 rowId 指定的值。
			ajax: {
				url: "",									// 数据源
				type: "POST"								// 请求方式，默认 `POST` 提交
			},
			dom: "",										// 自定义 DOM
			columns: [],									// 自定义表格列
		};
		
		/**
		 * 增加索引列
		 */
		function _fnAddIndexing () {
			return { data: null, title: "序号", render: function (data, type, row, meta) {
				return meta.row + 1;
			}};
		}
		
		/**
		 * 增加勾选列
		 * @return {Object} 勾选对象
		 */
		function _fnAddChecking () {
			var _checkObj = {}; // 定义勾选列
				_checkObj.title = "<input type='checkbox' class='dataTables_allcheck'/>"; // 表头
				_checkObj.orderable = false; // 关闭排序功能
				_checkObj.data = null; // 设置自定义的列 data = null
				_checkObj.defaultContent = "<input type='checkbox' class='dataTables_check'/>"; // 默认列的内容是复选框
			return _checkObj;
		}
		
		/**
		 * 自定义Dom
		 * @return {String} 返回上下分页Dom元素,渲染后的Dom结构是
		 * @example
		 * <div class="row">
		 * 		<div class="col-sm-7"> 这里渲染的是页码 </div>
		 * 		<div class="col-sm-5"> 这里渲染的是 页码信息及跳转按钮 </div>
		 * </div>
		 * 其中 `p`、`i`、`rt`是DataTables中的模版字符串。关于自定义Dom请参考 DataTables API文档
		 */
		function _fnCustomerDom () {
			var dom = '<"row"<"col-sm-7"p><"neris-page-info col-sm-5"i>>';
			if ( _settings.pageShow === "top" ) {
				return dom + "rt";
			} else if ( _settings.pageShow === "bottom" ) {
				return "rt" + dom;
			} else if ( _settings.pageShow === "all" ) {
				return dom + "rt" + dom;
			}
			
		}
		
		/**
		 * 初始化表格
		 * @param {Object} _settings 选项
		 */
		function _fnInitDataTables () {
			$.fn.dataTable.ext.errMode = 'none'; // 设置错误提示方式： `alert`、`throw` and `none`
			// 初始化表格配置
			_tableObj = $( _tableId ).DataTable({
				  language: _settings.language,
				processing: _settings.processing,
				serverSide: _settings.serverSide,
					 rowId: _settings.rowId,
				    paging: _settings.paging,
				pageLength: _settings.pageLength,
				   scrollX: _settings.scrollX,
				  ordering: _settings.ordering,
				      ajax:	_settings.ajax,
				       dom: _fnCustomerDom(),
				   columns: _settings.columns,
				   
				/**
				 * 表格初始化完成回调
				 * @param {Object} settings
				 * @param {Object} json
				 */
				initComplete: function ( settings, json ) {
					_fnAddPageInfoAndJumpBtn( this.api().page.info() ); // 增加分页显示信息和跳转按钮DOM元素
					if ( _settings.scrollX ) { // 如果启用滚动条选项则初始化滚动条
						_fnInitCustomScrollbar();
					}
				},
				
				/**
				 * 每行渲染完成回调。处理翻页勾选
				 * @param {Object} row 当前行
				 * @param {Object} data 行数据
				 */
				rowCallback: function ( row, data ) {
					if ( _settings.checking && _settings.rowId ) {
						if ( $.inArray( data[ _settings.rowId ], _selectedCache[ _fnGetCacheKey() ] ) !== -1 ) {
							_fnSetCheckedState( row, true );
						}
					}
				}
			});
			
			// 初始化事件
			if ( _settings.checking ) {
				_fnInitEvents();
			}
		}
		
		/**
		 * 初始化事件
		 */
		function _fnInitEvents () {
			// 表格渲染事件，这是 DataTables 插件自带的事件
			$( _tableId ).on( "draw.dt", function () {
				if ( _allcheckCache[ _fnGetCacheKey() ] ) {
					_fnSetAllcheckState( true );
				} else {
					_fnSetAllcheckState( false );
				}
			});
			
			// 单选事件
			$( _tableObj.table().body() ).on( "click", ".dataTables_check", function ( event ) {
				_fnHandleSelectedCache( $( this ).closest( "tr" )[0] ); // 处理勾选
				// 触发全选按钮状态监听事件
				$( _tableObj.table().header() ).find("input.dataTables_allcheck").trigger( "listener.row.click" );
				
			});
			
			// 全选事件，`_tableObj.table().header()` 是 DataTables 插件提供的方法，用来获取 `thead` 的 DOM
			$( _tableObj.table().header() ).on( "click", "input.dataTables_allcheck", function ( event ) {
				var ischecked = $( this ).prop("checked"), // 勾选状态标识
						nodes = _fnGetRowsNodesOfCurrentPage(); // 当前页的所有行节点集合
					
				if ( ischecked ) { // 全选
					_fnHandleAllcheckCache( "save" ); // 处理全选：保存全选状态
					// 获取当前页所有未勾选的行,遍历
					$( nodes ).find("input.dataTables_check[type='checkbox']").not(":checked").each( function ( index, curInput ) {
						_fnHandleSelectedCache( $( curInput ).closest( "tr" )[0] ); // 设置勾选
					});
					
				} else { // 取消全选
					_fnHandleAllcheckCache( "del" ); // 处理勾选：删除全选状态
					// 获取当前页所有勾选的行,遍历
					$( nodes ).find("input.dataTables_check[type='checkbox']:checked").each( function ( index, curInput ) {
						_fnHandleSelectedCache( $( curInput ).closest( "tr" )[0] ); // 设置勾选
					});
				}
				
			});
			
			// 自定义的全选按钮DOM监听行点击事件，每点击行都会检查全选按钮的勾选状态
			$( _tableObj.table().header() ).on( "listener.row.click", "input.dataTables_allcheck", function () {
				// 如果当前页选择的数据长度等于当前页的行数
				if ( _selectedCache[ _fnGetCacheKey() ].length === _fnGetRowsNodesOfCurrentPage().length ) {
					_fnSetAllcheckState( true ); // 设置全选按钮为勾选状态
					_fnHandleAllcheckCache( "save" ); // 保存当前页的全选按钮的勾选状态到缓存数组
				} else {
					_fnSetAllcheckState( false );
					_fnHandleAllcheckCache( "del" );
				}
			});
			
			// 跳转事件
			$( _containerId ).find(".neris-page-info").delegate(".btn-jump", "click", function ( event ) {
				var jumpInputObj = $( this ).siblings(),
						 pageNum = parseInt( jumpInputObj.val().trim() ),
							 msg = "请输入有效的页码!";
				
				// 如果输入值是非数字 || 非正整数 || 大于最大页数
				if ( isNaN( pageNum ) || !/^[1-9]\d*$/.test( pageNum ) || pageNum > _tableObj.page.info().pages ) {
					jumpInputObj.focus().val("");
					alert( msg );
					return;
				}
				
				// 跳转页面的索引是从 0 开始的，所以这里是 pageNum - 1
				_tableObj.page( pageNum - 1 ).draw(false);
				
			});
		}
		
		/**
		 * 获取当前页的行节点
		 */
		function _fnGetRowsNodesOfCurrentPage () {
			return _tableObj.rows( { page: "current" } ).nodes();
		}
		
		/**
		 * 处理 `selectedCache` 缓存数组
		 * @param {Object} row 当前行的DOM元素
		 */
		function _fnHandleSelectedCache ( row ) {
			var rowId = row.id, k = _fnGetCacheKey(), index;
			// 初始化
			if ( !_selectedCache[ k ] ) {
				_selectedCache[ k ] = [];
			}
			
			index = $.inArray( rowId, _selectedCache[ k ] ); // 判断当前页是否有勾选过的数据
			
			// 如果当前页的这行数据没有勾选
			if ( index === -1 ) {
				_fnSetCheckedState( row, true ); // 设置勾选
				_selectedCache[ k ].push( rowId ); // 把 tr 的 id 属性值保存到对应当前页的数组中去
			} else {
				_fnSetCheckedState( row, false ); // 取消勾选
				_selectedCache[ k ].splice( index, 1 ); // 把 tr 的 id 属性值从 缓存中删除。
			}
		}
		
		/**
		 * 处理 `allcheckCache` 全选缓存数组对象
		 * @param {Object} type 处理类型： `save` 保存；`del` 删除。
		 */
		function _fnHandleAllcheckCache ( type ) {
			var k = _fnGetCacheKey();
			
			if ( !_allcheckCache[ k ] ) {
				_allcheckCache[ k ] = {};
			}
			
			// 保存当前页的全选按钮为勾选状态
			if ( type === "save" ) {
				_allcheckCache[ k ].checked = true;
			}
			
			// 删除当前页的全选按钮的勾选状态
			if ( type === "del" ) {
				delete _allcheckCache[ k ];
			}
		}
		
		/**
		 * 设置行中勾选框的状态
		 * @param {Object} row 行DOM元素
		 * @param {Boolean} state 状态
		 */
		function _fnSetCheckedState ( row, state ) {
			$( row ).find("input.dataTables_check").prop("checked", state);
		}
		
		/**
		 * 设置全选按钮勾选状态
		 * @param {Boolean} state 状态
		 */
		function _fnSetAllcheckState ( state ) {
			$( _tableObj.table().header() ).find(".dataTables_allcheck").prop("checked", state);
		}
		
		/**
		 * 得到当前页
		 */
		function _fnGetCurrentPage () {
			return ( _tableObj.page() + 1 ) || 1 ;
		}
		
		/**
		 * 获取缓存数组中的 key
		 */
		function _fnGetCacheKey () {
			return _fnGetCurrentPage() + "_of_page";
		}
		
		/**
		 * 增加分页显示信息和跳转按钮
		 * @param {Object} pageInfo 分页信息对象包含当前页、总页数等
		 */
		function _fnAddPageInfoAndJumpBtn ( pageInfo ) {
			var info = [];
				info.push('<div class="dataTables_info">共 ', pageInfo.pages, ' 页，');
				info.push(pageInfo.recordsTotal, ' 条记录。跳转到第 ');
				info.push('<input type="text" class="jump-page"/> 页');
				info.push('<button class="btn btn-xs btn-primary btn-jump">GO</button></div>');
				$( _containerId ).find(".neris-page-info").html( info.join(" ") );
		}
		
		/**
		 * 初始化滚动条
		 */
		function _fnInitCustomScrollbar () {		
			$( _containerId ).find(".dataTables_scroll").mCustomScrollbar({
				theme: 'minimal-dark',
				horizontalScroll: true,
				advanced: {
					updateOnSelectorChange: true
				},
				callbacks: {
					onScroll: function () {
						// 删除类 `mCustomScrollBox` 自动生成的 style 行样式
						// 主要是兼容 标签页。如果表格组件嵌套在 tab 标签页中，切换的时候滚动条插件会设置它的 `max-height:0` 导致表格数据显示不出来。
						$( _containerId ).find(".mCustomScrollBox").removeAttr("style");
					}
				}
			});
			
			// 删除默认的滚动条
			$( _containerId ).find(".dataTables_scrollBody").removeAttr("style");
			$( _containerId ).find(".mCSB_horizontal.mCSB_inside .mCSB_container").css( { marginBottom: "10px" } );
		}
		
		/**
		 * 克隆数组
		 * @param {Object} arrs 要克隆的数组
		 * @return 返回新的数组
		 */
		function _fnCloneArray ( arrs ) {
			var cloneAttrs = [];
			for ( var i in arrs ) {
				if ( !cloneAttrs[ i ] ) {
					cloneAttrs[ i ] = [];					
				}
				for ( var j = 0, len = arrs[ i ].length; j < len; j++ ) {
					cloneAttrs[ i ].push( arrs[ i ][ j ] );
				}
			}
			return cloneAttrs;
		}
		
		/**
		 * 得到选中的数据
		 */
		function _fnGetSelected () {
			var tempAttrs = _fnCloneArray( _selectedCache ), selectedDatas = [];
			for ( var prop in tempAttrs ) {
				if ( tempAttrs.hasOwnProperty( prop ) ) {
					for ( var i = 0, len = tempAttrs[ prop ].length; i < len; i++ ) {
						selectedDatas.push( tempAttrs[ prop ][ i ] );
					}
				}
			}
			return selectedDatas;
		}
		
		/**
		 * 得到最大页数
		 */
		function _fnGetMaxPage () {
			return _tableObj.page.info().pages;
		}
		
		/**
		 * 设置页码
		 * @param {String|Int} set 设置页码
		 * 当 set 为 Int 类型时，跳转到指定页，当 set 为 String 类型时只能是下面几种： 
		 * `first`: 首页
		 * `last`: 末页
		 * `next`: 下一页
		 * `previous`: 上一页
		 */
		function _fnSetPage ( set ) {
			if ( !set || parseInt( set, 10 ) < 0 ) {
				set = 1;
			}
			
			if ( typeof set === "string" && /^[first|last|next|previous]+$/.test( set ) ) {
				_tableObj.page( set ).draw( false );
			} else if ( typeof set === "number" )  {
				var maxPage = _fnGetMaxPage();
				if ( set >= maxPage ) {
					set = maxPage;
				}
				_tableObj.page( set - 1 ).draw( false );
			}	
		}
		
	/**
	 * 对外提供额接口方法
	 */
	$.fn.nerisDataTables = NerisDataTables;
	
});