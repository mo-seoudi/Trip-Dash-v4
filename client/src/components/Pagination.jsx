import React from "react";

const Pagination = ({
  totalItems,
  rowsPerPage,
  currentPage,
  onPageChange,
  onRowsPerPageChange,
  showGoToPage = true,
  jumpPageInput,
  setJumpPageInput,
  onJump,
}) => {
  const totalPages = Math.ceil(totalItems / rowsPerPage);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 text-xs space-y-2 sm:space-y-0">
      <div className="text-gray-600">
        {totalItems === 0
          ? "0 of 0 Trips"
          : `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(
              currentPage * rowsPerPage,
              totalItems
            )} of ${totalItems} Trips`}
      </div>

      <div className="flex items-center space-x-2">
        <select
          value={rowsPerPage}
          onChange={(e) => {
            onRowsPerPageChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="border p-1 rounded"
        >
          <option value={12}>Rows 12</option>
          <option value={25}>Rows 25</option>
          <option value={50}>Rows 50</option>
        </select>
      </div>

      <div className="flex items-center space-x-1">
        {totalPages > 2 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-gray-700 disabled:opacity-50"
            >
              {"<<"}
            </button>
          </>
        )}
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-2 py-1 text-gray-700 disabled:opacity-50"
        >
          {"<"}
        </button>

        <span>
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-gray-700 disabled:opacity-50"
        >
          {">"}
        </button>
        {totalPages > 2 && (
          <>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-gray-700 disabled:opacity-50"
            >
              {">>"}
            </button>
            {showGoToPage && (
              <>
                <input
                  type="text"
                  value={jumpPageInput}
                  onChange={(e) => {
                    // Only allow digits
                    const value = e.target.value;
                    if (/^\d*$/.test(value)) {
                      setJumpPageInput(value);
                    }
                  }}
                  placeholder="Page"
                  className="w-12 p-1 border rounded text-xs"
                />
                <button
                  onClick={onJump}
                  className="px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Go
                </button>
              </>
            )}

          </>
        )}
      </div>
    </div>
  );
};

export default Pagination;
