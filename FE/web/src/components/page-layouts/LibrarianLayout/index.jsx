import { Outlet } from "react-router-dom";
import Sidebar from "../../layouts/Sidebar";
import Topbar from "../../layouts/Topbar";
import { librarianMenuItems } from "../../../config/librarianMenuItems";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";

export const SIDEBAR_WIDTH = 280;
export const APPBAR_HEIGHT = 64; 

const Container = styled("div")(({ theme }) => ({
  minHeight: "100vh",
  backgroundColor: theme.palette.background.default,
}));

const Main = styled("main")(({ theme }) => ({
  marginLeft: SIDEBAR_WIDTH,
  paddingTop: APPBAR_HEIGHT , 
  paddingLeft: 0,
  paddingRight: 0,
  paddingBottom: theme.spacing(3),
  minHeight: "100vh",
  boxSizing: "border-box",
}));

const Content = styled(Box)(({ theme }) => ({
  background: theme.palette.background.paper,
  borderRadius: 16,
  boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
  padding: theme.spacing(3),
  minHeight: `calc(100vh - ${APPBAR_HEIGHT + 16 + 24}px)`,
}));

export default function LibrarianLayout() {
  return (
    <Container className="admin-container">
      <Sidebar role="Thủ thư" menuItems={librarianMenuItems} />
      <Topbar />
      <Main className="main">
        <Content className="content">
          <Outlet />
        </Content>
      </Main>
    </Container>
  );
}
