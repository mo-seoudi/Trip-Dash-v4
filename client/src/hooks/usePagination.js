import { useState } from "react";

export const usePagination = (data, defaultRowsPerPage = 12) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [jumpPageInput, setJumpPageInput] = useState("");

  const totalPages = Math.ceil(data.length / rowsPerPage);

  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const paginatedData = data.slice(indexOfFirst, indexOfLast);

  const handleJump = () => {
    const pageNum = Number(jumpPageInput);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpPageInput("");
    }
  };

  return {
    paginatedData,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    jumpPageInput,
    setJumpPageInput,
    handleJump,
    totalPages,
  };
};
